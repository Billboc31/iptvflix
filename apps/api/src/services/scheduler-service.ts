import { and, desc, eq, gt, isNull, or, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { sources } from '../db/schema/sources.js'
import { syncRuns } from '../db/schema/sync-runs.js'
import { episodes } from '../db/schema/episodes.js'
import { seasons } from '../db/schema/seasons.js'
import { series } from '../db/schema/series.js'
import { mediaSegments } from '../db/schema/media-segments.js'
import type { TriggerSyncBody } from '@iptvflix/api-contracts'
import type { DiscoveryCandidatePoolService } from './discovery-candidate-pool-service.js'
import { type CatalogRefreshService, CatalogRefreshAlreadyRunningError } from './catalog-refresh-service.js'
import type { SegmentSyncService } from './segment-sync-service.js'

async function withBoundedConcurrency<T>(
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

type Db = PostgresJsDatabase<typeof schema>

const ALL_FEEDS = ['popular', 'trending', 'upcoming'] as const
const ALL_MEDIA_TYPES = ['MOVIE', 'SERIES'] as const

interface SchedulerConfig {
  enabled: boolean
  sourceSyncCadenceMinutes: number
  discoveryCadenceMinutes: number
  sourceSyncConcurrency: number
  startupDelayMs: number
  catalogRefreshEnabled?: boolean
  catalogRefreshCadenceHours?: number
  segmentRefreshEnabled?: boolean
  segmentRefreshCadenceHours?: number
  segmentRefreshRecentDays?: number
}

export class SchedulerService {
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private sourceSyncTimer: ReturnType<typeof setInterval> | null = null
  private discoveryTimer: ReturnType<typeof setInterval> | null = null
  private catalogRefreshTimer: ReturnType<typeof setInterval> | null = null
  private segmentRefreshTimer: ReturnType<typeof setInterval> | null = null
  private segmentRefreshTickCount = 0

  constructor(
    private readonly db: Db,
    private readonly triggerSync: (body: TriggerSyncBody) => Promise<unknown>,
    private readonly discoveryPoolService: DiscoveryCandidatePoolService | null,
    private readonly config: SchedulerConfig,
    private readonly catalogRefreshService: CatalogRefreshService | null = null,
    private readonly segmentSyncService: SegmentSyncService | null = null,
  ) {}

  start(): void {
    if (!this.config.enabled) return

    this.startupTimer = setTimeout(() => {
      this.startupTimer = null

      void this.runSourceSyncTick()
      void this.runDiscoveryTick()

      this.sourceSyncTimer = setInterval(
        () => void this.runSourceSyncTick(),
        this.config.sourceSyncCadenceMinutes * 60_000,
      )

      this.discoveryTimer = setInterval(
        () => void this.runDiscoveryTick(),
        this.config.discoveryCadenceMinutes * 60_000,
      )

      if ((this.config.catalogRefreshEnabled ?? true) && this.catalogRefreshService) {
        void this.runCatalogRefreshTick()
        this.catalogRefreshTimer = setInterval(
          () => void this.runCatalogRefreshTick(),
          (this.config.catalogRefreshCadenceHours ?? 24) * 3_600_000,
        )
      }

      if ((this.config.segmentRefreshEnabled ?? false) && this.segmentSyncService) {
        void this.runSegmentRefreshTick()
        this.segmentRefreshTimer = setInterval(
          () => void this.runSegmentRefreshTick(),
          (this.config.segmentRefreshCadenceHours ?? 24) * 3_600_000,
        )
      }
    }, this.config.startupDelayMs)
  }

  stop(): void {
    if (this.startupTimer !== null) {
      clearTimeout(this.startupTimer)
      this.startupTimer = null
    }
    if (this.sourceSyncTimer !== null) {
      clearInterval(this.sourceSyncTimer)
      this.sourceSyncTimer = null
    }
    if (this.discoveryTimer !== null) {
      clearInterval(this.discoveryTimer)
      this.discoveryTimer = null
    }
    if (this.catalogRefreshTimer !== null) {
      clearInterval(this.catalogRefreshTimer)
      this.catalogRefreshTimer = null
    }
    if (this.segmentRefreshTimer !== null) {
      clearInterval(this.segmentRefreshTimer)
      this.segmentRefreshTimer = null
    }
  }

  private async runSourceSyncTick(): Promise<void> {
    let enabledSources: (typeof sources.$inferSelect)[]
    try {
      enabledSources = await this.db.select().from(sources).where(eq(sources.enabled, true))
    } catch (err) {
      console.error('[scheduler] Failed to fetch enabled sources:', err)
      return
    }

    const cadenceMs = this.config.sourceSyncCadenceMinutes * 60_000
    const now = Date.now()

    const tasks = enabledSources.map((source) => async () => {
      try {
        const [lastRun] = await this.db
          .select()
          .from(syncRuns)
          .where(and(eq(syncRuns.sourceId, source.id), eq(syncRuns.status, 'COMPLETED')))
          .orderBy(desc(syncRuns.completedAt))
          .limit(1)

        const lastCompleted = lastRun?.completedAt?.getTime() ?? 0
        if (now - lastCompleted < cadenceMs) return

        await this.triggerSync({ sourceId: source.id })
      } catch (err) {
        const statusCode = (err as Error & { statusCode?: number }).statusCode
        if (statusCode === 409) {
          console.debug(`[scheduler] Source ${source.id} already syncing, skipping`)
          return
        }
        console.error(`[scheduler] Source ${source.id} sync error:`, err)
      }
    })

    await withBoundedConcurrency(tasks, this.config.sourceSyncConcurrency)
  }

  private async runDiscoveryTick(): Promise<void> {
    if (!this.discoveryPoolService) return
    try {
      await this.discoveryPoolService.evictStale()
      await this.discoveryPoolService.refreshPool([...ALL_FEEDS], [...ALL_MEDIA_TYPES])
    } catch (err) {
      console.error('[scheduler] Discovery tick error:', err)
    }
  }

  private async runCatalogRefreshTick(): Promise<void> {
    if (!this.catalogRefreshService) return
    try {
      const last = await this.catalogRefreshService.getLastCompletedRun()
      const cadenceMs = (this.config.catalogRefreshCadenceHours ?? 24) * 3_600_000
      if (last?.completedAt && Date.now() - last.completedAt.getTime() < cadenceMs) return
      await this.catalogRefreshService.run()
    } catch (err) {
      if (err instanceof CatalogRefreshAlreadyRunningError) {
        console.debug('[scheduler] Catalog refresh already running, skipping')
        return
      }
      console.error('[scheduler] Catalog refresh tick error:', err)
    }
  }

  private async runSegmentRefreshTick(): Promise<void> {
    if (!this.segmentSyncService) return
    this.segmentRefreshTickCount++
    const tick = this.segmentRefreshTickCount
    const recentDays = this.config.segmentRefreshRecentDays ?? 30
    const recentCutoff = new Date(Date.now() - recentDays * 86_400_000)
    const CONCURRENCY = 3

    try {
      // Priority 1: episodes aired recently — refresh every tick
      const recentRows = await this.db
        .select({
          episodeId: episodes.id,
          episodeNumber: episodes.episodeNumber,
          seriesId: episodes.seriesId,
          seasonNumber: seasons.seasonNumber,
        })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .innerJoin(series, eq(episodes.seriesId, series.id))
        .where(
          and(
            gt(episodes.airDate, recentCutoff.toISOString().slice(0, 10)),
            sql`${series.tmdbId} IS NOT NULL`,
          ),
        )
        .limit(100)

      const recentTasks = recentRows.map((row) => () =>
        this.segmentSyncService!.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber),
      )
      await withBoundedConcurrency(recentTasks, CONCURRENCY)

      // Priority 2: no-data episodes — retry every 3 ticks
      if (tick % 3 === 0) {
        const noDataRows = await this.db
          .select({
            episodeId: episodes.id,
            episodeNumber: episodes.episodeNumber,
            seriesId: episodes.seriesId,
            seasonNumber: seasons.seasonNumber,
          })
          .from(episodes)
          .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
          .innerJoin(series, eq(episodes.seriesId, series.id))
          .where(
            and(
              sql`${series.tmdbId} IS NOT NULL`,
              isNull(
                this.db
                  .select({ id: mediaSegments.id })
                  .from(mediaSegments)
                  .where(eq(mediaSegments.episodeId, episodes.id))
                  .limit(1)
                  .as('seg'),
              ),
            ),
          )
          .limit(50)

        const noDataTasks = noDataRows.map((row) => () =>
          this.segmentSyncService!.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber),
        )
        await withBoundedConcurrency(noDataTasks, CONCURRENCY)
      }

      // Priority 3: stable episodes — refresh every 7 ticks
      if (tick % 7 === 0) {
        const stableRows = await this.db
          .select({
            episodeId: episodes.id,
            episodeNumber: episodes.episodeNumber,
            seriesId: episodes.seriesId,
            seasonNumber: seasons.seasonNumber,
          })
          .from(episodes)
          .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
          .innerJoin(series, eq(episodes.seriesId, series.id))
          .where(
            and(
              or(
                isNull(episodes.airDate),
                sql`${episodes.airDate} <= ${recentCutoff.toISOString().slice(0, 10)}`,
              ),
              sql`${series.tmdbId} IS NOT NULL`,
            ),
          )
          .limit(50)

        const stableTasks = stableRows.map((row) => () =>
          this.segmentSyncService!.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber),
        )
        await withBoundedConcurrency(stableTasks, CONCURRENCY)
      }
    } catch (err) {
      console.error('[scheduler] Segment refresh tick error:', err)
    }
  }
}
