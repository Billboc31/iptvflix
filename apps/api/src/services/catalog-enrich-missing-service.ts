import { and, asc, count, eq, gt, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { catalogRefreshRuns } from '../db/schema/catalog-refresh-runs.js'
import { enrichmentFailures } from '../db/schema/enrichment-failures.js'
import type { MetadataEnrichmentService, EnrichResult } from './metadata-enrichment-service.js'

type Db = PostgresJsDatabase<typeof schema>

const ENRICH_MISSING_STALE_DAYS = 30
const TRANSIENT_RETRY_DELAYS_MS = [250, 500, 1000]

export interface EnrichMissingOptions {
  mediaTypes?: ('MOVIE' | 'SERIES')[]
  batchSize?: number
  concurrency?: number
  throttleMs?: number
  force?: boolean
  /** Resume from the checkpoint of a previously interrupted run (by run ID). */
  resumeRunId?: string
}

export interface EnrichMissingStats {
  totalEligible: number
  processed: number
  enriched: number
  skipped: number
  /** Counts retry *attempts*, not unique items — one item may contribute multiple counts. */
  retrying: number
  failedTerminal: number
  remaining: number
  ratePerMinute: number
  etaSeconds: number | null
}

type RunCheckpoint = {
  movies: { lastId: string | null; processedCount: number; done: boolean }
  series: { lastId: string | null; processedCount: number; done: boolean }
  stats?: Partial<EnrichMissingStats>
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  handler: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0
  let active = 0

  await new Promise<void>((resolve, reject) => {
    function next() {
      while (active < concurrency && index < items.length) {
        const item = items[index++]
        active++
        handler(item)
          .catch((err) => console.warn('[enrich-missing] item error:', err))
          .finally(() => {
            active--
            if (index >= items.length && active === 0) resolve()
            else next()
          })
      }
      if (items.length === 0) resolve()
    }
    try { next() } catch (e) { reject(e) }
  })
}

export class CatalogEnrichMissingService {
  constructor(
    private readonly db: Db,
    private readonly enrichmentService: MetadataEnrichmentService,
  ) {}

  private async checkNoRunningConflict(): Promise<void> {
    const [existing] = await this.db
      .select({ id: catalogRefreshRuns.id, type: catalogRefreshRuns.type })
      .from(catalogRefreshRuns)
      .where(eq(catalogRefreshRuns.status, 'RUNNING'))
      .limit(1)
    if (existing) {
      const err = new Error(`A ${existing.type} run is already RUNNING (id: ${existing.id})`)
      Object.assign(err, { code: 'RUN_CONFLICT' })
      throw err
    }
  }

  private async enrichWithRetry(fn: () => Promise<EnrichResult>, onRetry?: () => void): Promise<EnrichResult> {
    for (let attempt = 0; attempt < TRANSIENT_RETRY_DELAYS_MS.length; attempt++) {
      const result = await fn()
      if (result !== 'provider-failed') return result
      if (attempt < TRANSIENT_RETRY_DELAYS_MS.length - 1) {
        onRetry?.()
        await delay(TRANSIENT_RETRY_DELAYS_MS[attempt])
      }
    }
    return 'provider-failed'
  }

  async countEligible(mediaType: 'MOVIE' | 'SERIES', force: boolean): Promise<number> {
    const table = mediaType === 'MOVIE' ? movies : series
    const threshold = new Date(Date.now() - ENRICH_MISSING_STALE_DAYS * 86_400_000)
    const where = and(
      isNotNull(table.tmdbId),
      eq(table.matchStatus, 'MATCHED'),
      force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
    )
    const [row] = await this.db.select({ cnt: count() }).from(table).where(where)
    return Number(row?.cnt ?? 0)
  }

  async start(opts: EnrichMissingOptions = {}): Promise<string> {
    const {
      mediaTypes = ['MOVIE', 'SERIES'],
      batchSize = 50,
      concurrency = 3,
      throttleMs = 250,
      force = false,
      resumeRunId,
    } = opts

    await this.checkNoRunningConflict()

    let run: { id: string }
    try {
      const [inserted] = await this.db
        .insert(catalogRefreshRuns)
        .values({ type: 'ENRICH_MISSING', status: 'RUNNING', checkpoint: null })
        .returning({ id: catalogRefreshRuns.id })
      run = inserted
    } catch (err: unknown) {
      // Partial unique index violation: another run became RUNNING between check and insert
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        const conflict = new Error('A run is already RUNNING (concurrent insert detected)')
        Object.assign(conflict, { code: 'RUN_CONFLICT' })
        throw conflict
      }
      throw err
    }

    const runId = run.id

    const checkpoint: RunCheckpoint = {
      movies: { lastId: null, processedCount: 0, done: !mediaTypes.includes('MOVIE') },
      series: { lastId: null, processedCount: 0, done: !mediaTypes.includes('SERIES') },
    }

    // Resume from a previous run's cursor position if requested
    if (resumeRunId) {
      const [prevRun] = await this.db
        .select({ checkpoint: catalogRefreshRuns.checkpoint })
        .from(catalogRefreshRuns)
        .where(eq(catalogRefreshRuns.id, resumeRunId))
        .limit(1)
      const prev = prevRun?.checkpoint as RunCheckpoint | null
      if (prev) {
        if (prev.movies) {
          checkpoint.movies.lastId = prev.movies.done ? null : prev.movies.lastId
          checkpoint.movies.done = prev.movies.done || !mediaTypes.includes('MOVIE')
        }
        if (prev.series) {
          checkpoint.series.lastId = prev.series.done ? null : prev.series.lastId
          checkpoint.series.done = prev.series.done || !mediaTypes.includes('SERIES')
        }
      }
    }

    const totalMovies = mediaTypes.includes('MOVIE') ? await this.countEligible('MOVIE', force) : 0
    const totalSeries = mediaTypes.includes('SERIES') ? await this.countEligible('SERIES', force) : 0

    const stats = {
      totalEligible: totalMovies + totalSeries,
      processed: 0,
      enriched: 0,
      skipped: 0,
      retrying: 0,
      failedTerminal: 0,
    }

    const startMs = Date.now()

    const saveCheckpoint = async () => {
      const elapsedMin = (Date.now() - startMs) / 60_000
      const rate = elapsedMin > 0 ? stats.processed / elapsedMin : 0
      const remaining = stats.totalEligible - stats.processed
      const eta = rate > 0 ? (remaining / rate) * 60 : null
      checkpoint.stats = { ...stats, remaining, ratePerMinute: rate, etaSeconds: eta }
      await this.db
        .update(catalogRefreshRuns)
        .set({ checkpoint })
        .where(eq(catalogRefreshRuns.id, runId))
    }

    void this.execute({
      runId,
      mediaTypes,
      batchSize,
      concurrency,
      throttleMs,
      force,
      checkpoint,
      stats,
      saveCheckpoint,
    }).catch((err) => {
      console.error('[enrich-missing] run failed:', err)
      void this.db
        .update(catalogRefreshRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage: String(err) })
        .where(eq(catalogRefreshRuns.id, runId))
    })

    return runId
  }

  private async execute(ctx: {
    runId: string
    mediaTypes: ('MOVIE' | 'SERIES')[]
    batchSize: number
    concurrency: number
    throttleMs: number
    force: boolean
    checkpoint: RunCheckpoint
    stats: { totalEligible: number; processed: number; enriched: number; skipped: number; retrying: number; failedTerminal: number }
    saveCheckpoint: () => Promise<void>
  }): Promise<void> {
    const { runId, mediaTypes, batchSize, concurrency, throttleMs, force, checkpoint, stats, saveCheckpoint } = ctx
    const threshold = new Date(Date.now() - ENRICH_MISSING_STALE_DAYS * 86_400_000)

    for (const mediaType of mediaTypes) {
      const key = mediaType === 'MOVIE' ? 'movies' : 'series'
      const table = mediaType === 'MOVIE' ? movies : series

      while (!checkpoint[key].done) {
        const lastId = checkpoint[key].lastId

        const eligible = and(
          isNotNull(table.tmdbId),
          eq(table.matchStatus, 'MATCHED'),
          force ? undefined : or(isNull(table.metadataEnrichedAt), lt(table.metadataEnrichedAt, threshold)),
          lastId ? gt(table.id, lastId) : undefined,
        )

        const batch = await this.db
          .select({ id: table.id })
          .from(table)
          .where(eligible)
          .orderBy(asc(table.id))
          .limit(batchSize)

        if (batch.length === 0) {
          checkpoint[key].done = true
          await saveCheckpoint()
          break
        }

        await runWithConcurrency(batch, concurrency, async (row) => {
          try {
            const result =
              mediaType === 'MOVIE'
                ? await this.enrichWithRetry(() => this.enrichmentService.enrichMovie(row.id, { force, runId }), () => { stats.retrying++ })
                : await this.enrichWithRetry(() => this.enrichmentService.enrichSeries(row.id, { force, runId }), () => { stats.retrying++ })

            stats.processed++
            checkpoint[key].processedCount++
            if (result === 'enriched') stats.enriched++
            else if (result === 'skipped' || result === 'no-tmdb-id') stats.skipped++
            else stats.failedTerminal++
          } catch {
            stats.processed++
            stats.failedTerminal++
            checkpoint[key].processedCount++
          }
        })

        checkpoint[key].lastId = batch[batch.length - 1].id
        await saveCheckpoint()

        if (batch.length < batchSize) {
          checkpoint[key].done = true
          await saveCheckpoint()
          break
        }

        if (throttleMs > 0) await delay(throttleMs)
      }
    }

    await this.db
      .update(catalogRefreshRuns)
      .set({ status: 'COMPLETED', completedAt: new Date(), failedCount: stats.failedTerminal })
      .where(eq(catalogRefreshRuns.id, runId))
  }

  async getLatestRunStatus(): Promise<{
    runId: string
    status: string
    startedAt: Date
    completedAt: Date | null
    stats: EnrichMissingStats | null
  } | null> {
    const [run] = await this.db
      .select()
      .from(catalogRefreshRuns)
      .where(eq(catalogRefreshRuns.type, 'ENRICH_MISSING'))
      .orderBy(sql`started_at DESC`)
      .limit(1)

    if (!run) return null

    const cp = run.checkpoint as RunCheckpoint | null
    const stats = cp?.stats
      ? {
          totalEligible: cp.stats.totalEligible ?? 0,
          processed: cp.stats.processed ?? 0,
          enriched: cp.stats.enriched ?? 0,
          skipped: cp.stats.skipped ?? 0,
          retrying: cp.stats.retrying ?? 0,
          failedTerminal: cp.stats.failedTerminal ?? 0,
          remaining: cp.stats.remaining ?? 0,
          ratePerMinute: cp.stats.ratePerMinute ?? 0,
          etaSeconds: cp.stats.etaSeconds ?? null,
        }
      : null

    return {
      runId: run.id,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt ?? null,
      stats,
    }
  }

  async listFailures(opts: {
    page: number
    limit: number
    mediaType?: string
    retryable?: boolean
  }): Promise<{ rows: (typeof enrichmentFailures.$inferSelect)[]; total: number }> {
    const { page, limit, mediaType, retryable } = opts
    const offset = (page - 1) * limit

    const conditions = []
    if (mediaType) conditions.push(eq(enrichmentFailures.mediaType, mediaType))
    if (retryable !== undefined) conditions.push(eq(enrichmentFailures.retryable, retryable))

    const where = conditions.length > 0 ? and(...conditions) : undefined

    const [rows, totalRow] = await Promise.all([
      this.db
        .select()
        .from(enrichmentFailures)
        .where(where)
        .orderBy(sql`occurred_at DESC`)
        .limit(limit)
        .offset(offset),
      this.db.select({ cnt: count() }).from(enrichmentFailures).where(where),
    ])

    return { rows, total: Number(totalRow[0]?.cnt ?? 0) }
  }

  async retryFailures(opts: { mediaType?: string; ids?: string[]; concurrency?: number; force?: boolean } = {}): Promise<{
    runId: string | null
    queued: number
  }> {
    const { mediaType, ids, concurrency = 3, force = false } = opts

    await this.checkNoRunningConflict()

    const conditions = []
    if (mediaType) conditions.push(eq(enrichmentFailures.mediaType, mediaType))
    if (ids && ids.length > 0) conditions.push(inArray(enrichmentFailures.mediaId, ids))
    // By default only retry retryable failures; pass force=true to retry all (including terminal)
    if (!force) conditions.push(eq(enrichmentFailures.retryable, true))

    const where = conditions.length > 0 ? and(...conditions) : undefined
    const failures = await this.db.select().from(enrichmentFailures).where(where)

    if (failures.length === 0) {
      return { runId: null, queued: 0 }
    }

    let run: { id: string }
    try {
      const [inserted] = await this.db
        .insert(catalogRefreshRuns)
        .values({ type: 'ENRICH_MISSING', status: 'RUNNING', checkpoint: null })
        .returning({ id: catalogRefreshRuns.id })
      run = inserted
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === '23505') {
        const conflict = new Error('A run is already RUNNING (concurrent insert detected)')
        Object.assign(conflict, { code: 'RUN_CONFLICT' })
        throw conflict
      }
      throw err
    }

    const runId = run.id

    const stats = {
      totalEligible: failures.length,
      processed: 0,
      enriched: 0,
      skipped: 0,
      retrying: 0,
      failedTerminal: 0,
    }

    void runWithConcurrency(failures, concurrency, async (failure) => {
      const mt = failure.mediaType as 'MOVIE' | 'SERIES'
      try {
        const result = mt === 'MOVIE'
          ? await this.enrichWithRetry(() => this.enrichmentService.enrichMovie(failure.mediaId, { force: true, runId }), () => { stats.retrying++ })
          : await this.enrichWithRetry(() => this.enrichmentService.enrichSeries(failure.mediaId, { force: true, runId }), () => { stats.retrying++ })
        stats.processed++
        if (result === 'enriched') stats.enriched++
        else if (result === 'skipped' || result === 'no-tmdb-id') stats.skipped++
        else stats.failedTerminal++
      } catch {
        stats.processed++
        stats.failedTerminal++
      }
    }).then(async () => {
      const finalCheckpoint = { stats: { ...stats, remaining: stats.failedTerminal, ratePerMinute: 0, etaSeconds: null } }
      await this.db
        .update(catalogRefreshRuns)
        .set({ status: 'COMPLETED', completedAt: new Date(), checkpoint: finalCheckpoint, failedCount: stats.failedTerminal })
        .where(eq(catalogRefreshRuns.id, runId))
    }).catch(async (err) => {
      await this.db
        .update(catalogRefreshRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage: String(err) })
        .where(eq(catalogRefreshRuns.id, runId))
    })

    return { runId, queued: failures.length }
  }
}
