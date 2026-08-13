import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { sources } from '../db/schema/sources.js'
import { series } from '../db/schema/series.js'
import { seasons } from '../db/schema/seasons.js'
import { seriesAvailabilities } from '../db/schema/availabilities.js'
import { XtreamCodesClient } from '../providers/xtream/client.js'
import type { XtreamSeriesInfo } from '../providers/xtream/types.js'
import { CatalogSyncService, acquireSyncRunLock, SyncAlreadyRunningError } from './catalog-sync-service.js'
import { withBoundedConcurrency } from './sync-runs-service.js'
import { TMDB_API_KEY } from '../config/env.js'
import { TmdbClient } from '../providers/metadata/tmdb/client.js'
import { MetadataEnrichmentService } from './metadata-enrichment-service.js'
import { CanonicalResolver } from './canonical-resolver.js'

export interface BackfillResult {
  processed: number
  succeeded: number
  failed: number
}

export interface BackfillState extends BackfillResult {
  startedAt: Date
  completedAt?: Date
}

export class EpisodeBackfillService {
  private latestState: BackfillState | null = null
  private running = false

  async backfill(opts?: { force?: boolean }): Promise<BackfillResult> {
    if (this.running) {
      return this.latestState ?? { processed: 0, succeeded: 0, failed: 0 }
    }

    this.running = true
    const startedAt = new Date()
    const result: BackfillResult = { processed: 0, succeeded: 0, failed: 0 }
    this.latestState = { ...result, startedAt }

    try {
      const xtreamSources = await db
        .select()
        .from(sources)
        .where(and(eq(sources.type, 'XTREAM'), eq(sources.enabled, true)))

      for (const source of xtreamSources) {
        await this.backfillSource(source, opts?.force ?? false, result)
        this.latestState = { ...result, startedAt }
      }
    } finally {
      this.running = false
      this.latestState = { ...result, startedAt, completedAt: new Date() }
    }

    return result
  }

  getLatestState(): BackfillState | null {
    return this.latestState
  }

  private async backfillSource(
    source: typeof sources.$inferSelect,
    force: boolean,
    result: BackfillResult,
  ): Promise<void> {
    const candidates = await db
      .select({
        seriesId: seriesAvailabilities.seriesId,
        providerItemId: seriesAvailabilities.providerItemId,
      })
      .from(seriesAvailabilities)
      .innerJoin(series, eq(seriesAvailabilities.seriesId, series.id))
      .where(
        and(
          eq(seriesAvailabilities.providerId, source.id),
          eq(seriesAvailabilities.status, 'AVAILABLE'),
          eq(series.matchStatus, 'MATCHED'),
        ),
      )

    const toProcess = force ? candidates : await this.filterZeroSeason(candidates)

    if (toProcess.length === 0) return

    result.processed += toProcess.length

    const concurrencyLimit = parseInt(process.env.XTREAM_SERIES_CONCURRENCY ?? '5', 10) || 5
    const infoClient = new XtreamCodesClient({
      baseUrl: source.baseUrl,
      username: source.username ?? '',
      password: source.password ?? '',
      timeoutMs: parseInt(process.env.XTREAM_SERIES_INFO_TIMEOUT_MS ?? '30000', 10),
    })

    const tasks = toProcess.map((item) => async () => {
      const seriesIdNum = parseInt(item.providerItemId, 10)
      if (isNaN(seriesIdNum)) throw new Error(`Invalid providerItemId: ${item.providerItemId}`)
      const info = await infoClient.getSeriesInfo(seriesIdNum)
      return { seriesIdNum, info }
    })

    const settled = await withBoundedConcurrency(tasks, concurrencyLimit)

    const seriesInfo: Record<number, XtreamSeriesInfo> = {}
    const failedSeriesIds: number[] = []

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i]
      if (r.status === 'fulfilled') {
        const { seriesIdNum, info } = r.value
        seriesInfo[seriesIdNum] = info
      } else {
        const item = toProcess[i]
        console.warn(
          `[episode-backfill] getSeriesInfo(${item.providerItemId}) failed for source ${source.id}:`,
          r.reason,
        )
        failedSeriesIds.push(parseInt(item.providerItemId, 10))
        result.failed++
      }
    }

    const successCount = Object.keys(seriesInfo).length
    if (successCount === 0) return

    // Synthetic snapshot: only episode data, skipLifecycle prevents touching existing availability
    const snapshot = {
      sourceId: source.id,
      fetchedAt: new Date(),
      vodCategories: [] as [],
      vodStreams: [] as [],
      seriesCategories: [] as [],
      series: [] as [],
      seriesInfo,
      failedSeriesIds: failedSeriesIds.length > 0 ? failedSeriesIds : undefined,
    }

    let runId: string
    try {
      runId = await acquireSyncRunLock(source.id)
    } catch (err) {
      if (err instanceof SyncAlreadyRunningError) {
        console.warn(`[episode-backfill] backfill lock already held for source ${source.id}, skipping`)
        result.failed += successCount
        return
      }
      throw err
    }

    try {
      const canonicalResolver = TMDB_API_KEY
        ? new CanonicalResolver(new MetadataEnrichmentService(db, new TmdbClient({ apiKey: TMDB_API_KEY })))
        : undefined
      await CatalogSyncService.syncCatalog(source.id, snapshot, {
        runId,
        skipLifecycle: true,
        canonicalResolver,
      })
      result.succeeded += successCount
    } catch (err) {
      console.error(`[episode-backfill] syncCatalog failed for source ${source.id}:`, err)
      result.failed += successCount
    }
  }

  private async filterZeroSeason(
    candidates: Array<{ seriesId: string; providerItemId: string }>,
  ): Promise<Array<{ seriesId: string; providerItemId: string }>> {
    if (candidates.length === 0) return []
    const seriesIds = candidates.map((c) => c.seriesId)
    const withSeasons = await db
      .select({ seriesId: seasons.seriesId })
      .from(seasons)
      .where(inArray(seasons.seriesId, seriesIds))
    const withSeasonsSet = new Set(withSeasons.map((r) => r.seriesId))
    return candidates.filter((c) => !withSeasonsSet.has(c.seriesId))
  }
}
