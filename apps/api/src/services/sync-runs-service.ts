import { desc, eq } from 'drizzle-orm'
import type { SyncRunResponse, TriggerSyncBody } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { sources } from '../db/schema/sources.js'
import { syncRuns } from '../db/schema/sync-runs.js'
import { XtreamCodesClient } from '../providers/xtream/client.js'
import type { XtreamCatalogSnapshot } from '../providers/xtream/types.js'
import { PlexClient } from '../providers/plex/client.js'
import type { PlexCatalogSnapshot } from '../providers/plex/types.js'
import { M3UClient } from '../providers/m3u/client.js'
import type { M3UCatalogSnapshot } from '../providers/m3u/types.js'
import { M3UAuthError, M3UNetworkError, M3UParseError } from '../providers/m3u/errors.js'
import {
  CatalogSyncService,
  SyncAlreadyRunningError,
  acquireSyncRunLock,
  failSyncRun,
  setSyncRunProgress,
} from './catalog-sync-service.js'
import { NotFoundError } from './source-service.js'
import { TMDB_API_KEY } from '../config/env.js'
import { TmdbClient } from '../providers/metadata/tmdb/client.js'
import { TitleMatchingService } from './title-matching-service.js'
import { MetadataEnrichmentService } from './metadata-enrichment-service.js'
import { CanonicalResolver } from './canonical-resolver.js'

function createOptionalTitleMatchingService(): TitleMatchingService | undefined {
  if (!TMDB_API_KEY) return undefined
  return new TitleMatchingService(new TmdbClient({ apiKey: TMDB_API_KEY }))
}

let _onNewEpisodeHook: ((episodeId: string) => void) | undefined

export function setOnNewEpisodeHook(fn: (episodeId: string) => void): void {
  _onNewEpisodeHook = fn
}

function createOptionalCanonicalResolver(): CanonicalResolver | undefined {
  if (!TMDB_API_KEY) return undefined
  return new CanonicalResolver(
    new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY })),
    _onNewEpisodeHook,
  )
}

type SyncRunRow = typeof syncRuns.$inferSelect

function toResponse(row: SyncRunRow): SyncRunResponse {
  const status =
    row.status === 'COMPLETED' ? 'DONE' : (row.status as SyncRunResponse['status'])
  const isRunning = row.status === 'RUNNING'
  return {
    id: row.id,
    sourceId: row.sourceId,
    status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.completedAt ? row.completedAt.toISOString() : null,
    moviesAdded: row.moviesCreated,
    seriesAdded: row.seriesCreated,
    seriesInfoFailed: row.failedCount,
    titleMatched: row.titleMatchedCount,
    progress: isRunning ? (row.errorMessage ?? null) : null,
    error: isRunning ? null : (row.errorMessage ?? null),
  }
}

export async function withBoundedConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length)
  const queue = tasks.map((task, i) => ({ task, i }))

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()!
      try {
        results[item.i] = { status: 'fulfilled', value: await item.task() }
      } catch (err) {
        results[item.i] = { status: 'rejected', reason: err }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => worker()))
  return results
}

export async function listSyncRuns(): Promise<SyncRunResponse[]> {
  const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(50)
  return rows.map(toResponse)
}

async function fetchXtreamSnapshot(
  source: typeof sources.$inferSelect,
  runId?: string,
): Promise<XtreamCatalogSnapshot> {
  // 60s is too short for 100k+ VOD payloads; allow longer list downloads.
  const listTimeoutMs = parseInt(process.env.XTREAM_LIST_TIMEOUT_MS ?? '180000', 10)
  const client = new XtreamCodesClient({
    baseUrl: source.baseUrl,
    username: source.username ?? '',
    password: source.password ?? '',
    timeoutMs: listTimeoutMs,
  })

  if (runId) await setSyncRunProgress(runId, 'Authentification Xtream…')
  await client.authenticate()
  if (runId) {
    await setSyncRunProgress(runId, 'Téléchargement du catalogue Xtream (films + séries)…')
  }
  const [vodCategories, vodStreams, seriesCategories, series] = await Promise.all([
    client.getVodCategories(),
    client.getVodStreams(),
    client.getSeriesCategories(),
    client.getSeries(),
  ])

  // Per-series episode fetch is extremely expensive on large catalogs (~50k
  // series). Opt-in via XTREAM_FETCH_SERIES_INFO=true; default skips it so the
  // first sync can finish with movies + series metadata.
  const fetchSeriesInfo = process.env.XTREAM_FETCH_SERIES_INFO === 'true'
  if (!fetchSeriesInfo) {
    console.info(
      `[xtream-snapshot] skipping getSeriesInfo for ${series.length} series ` +
        `(set XTREAM_FETCH_SERIES_INFO=true to enable)`,
    )
    if (runId) {
      await setSyncRunProgress(
        runId,
        `Catalogue reçu : ${vodStreams.length} films, ${series.length} séries — import en base…`,
      )
    }
    return {
      sourceId: source.id,
      fetchedAt: new Date(),
      vodCategories,
      vodStreams,
      seriesCategories,
      series,
      seriesInfo: {},
    }
  }

  const infoClient = new XtreamCodesClient({
    baseUrl: source.baseUrl,
    username: source.username ?? '',
    password: source.password ?? '',
    timeoutMs: parseInt(process.env.XTREAM_SERIES_INFO_TIMEOUT_MS ?? '30000', 10),
  })
  const concurrencyLimit = parseInt(process.env.XTREAM_SERIES_CONCURRENCY ?? '5', 10)
  const settledResults = await withBoundedConcurrency(
    series.map((s) => async () => {
      const info = await infoClient.getSeriesInfo(s.series_id)
      return [s.series_id, info] as const
    }),
    concurrencyLimit,
  )

  const seriesInfo: Record<number, Awaited<ReturnType<typeof infoClient.getSeriesInfo>>> = {}
  const failedSeriesIds: number[] = []
  for (let i = 0; i < settledResults.length; i++) {
    const r = settledResults[i]
    if (r.status === 'fulfilled') {
      const [id, info] = r.value
      seriesInfo[id] = info
    } else {
      failedSeriesIds.push(series[i].series_id)
      console.warn(`[xtream-snapshot] getSeriesInfo(${series[i].series_id}) failed:`, r.reason)
    }
  }

  return {
    sourceId: source.id,
    fetchedAt: new Date(),
    vodCategories,
    vodStreams,
    seriesCategories,
    series,
    seriesInfo,
    failedSeriesIds: failedSeriesIds.length > 0 ? failedSeriesIds : undefined,
  }
}

async function fetchM3USnapshot(source: typeof sources.$inferSelect): Promise<M3UCatalogSnapshot> {
  const timeoutMs = parseInt(process.env.M3U_FETCH_TIMEOUT_MS ?? '60000', 10)
  const client = new M3UClient({
    playlistUrl: source.baseUrl,
    username: source.username ?? undefined,
    password: source.password ?? undefined,
    timeoutMs,
  })
  return client.fetchSnapshot(source.id)
}

async function fetchPlexSnapshot(source: typeof sources.$inferSelect): Promise<PlexCatalogSnapshot> {
  const client = new PlexClient(source.baseUrl, source.password ?? '', 60_000)

  const sections = await client.fetchLibrarySections()
  const movieSections = sections.filter((s) => s.type === 'movie')
  const showSections = sections.filter((s) => s.type === 'show')

  const [allMovies, allShows, allEpisodes] = await Promise.all([
    Promise.all(movieSections.map((s) => client.fetchMovies(s.key))).then((arrays) =>
      arrays.flat(),
    ),
    Promise.all(showSections.map((s) => client.fetchShows(s.key))).then((arrays) =>
      arrays.flat(),
    ),
    Promise.all(showSections.map((s) => client.fetchEpisodes(s.key))).then((arrays) =>
      arrays.flat(),
    ),
  ])

  return {
    sourceId: source.id,
    fetchedAt: new Date(),
    movies: allMovies,
    shows: allShows,
    episodes: allEpisodes,
  }
}

export async function triggerSync(body: TriggerSyncBody): Promise<SyncRunResponse> {
  if (!body?.sourceId) {
    const err = new Error('sourceId is required')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  const [source] = await db.select().from(sources).where(eq(sources.id, body.sourceId))
  if (!source) throw new NotFoundError(body.sourceId)

  if (!source.enabled) {
    const err = new Error('Source is disabled')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  if (source.type !== 'XTREAM' && source.type !== 'PLEX' && source.type !== 'M3U') {
    const err = new Error('Only XTREAM, PLEX, and M3U sources can be synchronized')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  let runId: string
  try {
    runId = await acquireSyncRunLock(source.id)
  } catch (err) {
    if (err instanceof SyncAlreadyRunningError) {
      const conflict = new Error(err.message)
      ;(conflict as Error & { statusCode?: number }).statusCode = 409
      throw conflict
    }
    throw err
  }

  const [runningRow] = await db.select().from(syncRuns).where(eq(syncRuns.id, runId))
  if (!runningRow) {
    throw new Error('Failed to create sync run')
  }

  // Run catalog fetch + DB upsert in the background so the UI can poll RUNNING.
  void (async () => {
    const matchingService = createOptionalTitleMatchingService()
    const canonicalResolver = createOptionalCanonicalResolver()
    try {
      if (source.type === 'PLEX') {
        const snapshot = await fetchPlexSnapshot(source)
        await CatalogSyncService.syncPlexCatalog(source.id, snapshot, { runId, matchingService, canonicalResolver })
      } else if (source.type === 'M3U') {
        let snapshot: M3UCatalogSnapshot
        try {
          snapshot = await fetchM3USnapshot(source)
        } catch (fetchErr) {
          if (
            fetchErr instanceof M3UAuthError ||
            fetchErr instanceof M3UNetworkError ||
            fetchErr instanceof M3UParseError
          ) {
            await failSyncRun(runId, (fetchErr as Error).message)
            return
          }
          throw fetchErr
        }
        await CatalogSyncService.syncM3UCatalog(source.id, snapshot, { runId, matchingService, canonicalResolver })
      } else {
        const snapshot = await fetchXtreamSnapshot(source, runId)
        await CatalogSyncService.syncCatalog(source.id, snapshot, { runId, matchingService, canonicalResolver })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[sync-runs] background sync failed runId=${runId}:`, err)
      try {
        await failSyncRun(runId, message)
      } catch (persistErr) {
        console.error(`[sync-runs] failed to mark run FAILED runId=${runId}:`, persistErr)
      }
    }
  })()

  return toResponse(runningRow)
}
