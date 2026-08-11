import { desc, eq } from 'drizzle-orm'
import type { SyncRunResponse, TriggerSyncBody } from '@iptvflix/api-contracts'
import { db } from '../db/client.js'
import { sources } from '../db/schema/sources.js'
import { syncRuns } from '../db/schema/sync-runs.js'
import { XtreamCodesClient } from '../providers/xtream/client.js'
import type { XtreamCatalogSnapshot } from '../providers/xtream/types.js'
import {
  CatalogSyncService,
  SyncAlreadyRunningError,
} from './catalog-sync-service.js'
import { NotFoundError } from './source-service.js'

type SyncRunRow = typeof syncRuns.$inferSelect

function toResponse(row: SyncRunRow): SyncRunResponse {
  const status =
    row.status === 'COMPLETED' ? 'DONE' : (row.status as SyncRunResponse['status'])
  return {
    id: row.id,
    sourceId: row.sourceId,
    status,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.completedAt ? row.completedAt.toISOString() : null,
    moviesAdded: row.moviesCreated,
    seriesAdded: row.seriesCreated,
    error: row.errorMessage ?? null,
  }
}

export async function listSyncRuns(): Promise<SyncRunResponse[]> {
  const rows = await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(50)
  return rows.map(toResponse)
}

async function fetchXtreamSnapshot(source: typeof sources.$inferSelect): Promise<XtreamCatalogSnapshot> {
  const client = new XtreamCodesClient({
    baseUrl: source.baseUrl,
    username: source.username ?? '',
    password: source.password ?? '',
    timeoutMs: 60_000,
  })

  await client.authenticate()
  const [vodCategories, vodStreams, seriesCategories, series] = await Promise.all([
    client.getVodCategories(),
    client.getVodStreams(),
    client.getSeriesCategories(),
    client.getSeries(),
  ])

  return {
    sourceId: source.id,
    fetchedAt: new Date(),
    vodCategories,
    vodStreams,
    seriesCategories,
    series,
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

  if (source.type !== 'XTREAM') {
    const err = new Error('Only XTREAM sources can be synchronized for now')
    ;(err as Error & { statusCode?: number }).statusCode = 400
    throw err
  }

  try {
    const snapshot = await fetchXtreamSnapshot(source)
    const result = await CatalogSyncService.syncCatalog(source.id, snapshot)
    const [row] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.runId))
    if (!row) {
      throw new Error('Sync completed but run record is missing')
    }
    return toResponse(row)
  } catch (err) {
    if (err instanceof SyncAlreadyRunningError) {
      const conflict = new Error(err.message)
      ;(conflict as Error & { statusCode?: number }).statusCode = 409
      throw conflict
    }
    throw err
  }
}
