import { and, desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { sources } from '../db/schema/sources.js'
import { syncRuns } from '../db/schema/sync-runs.js'
import type { TriggerSyncBody } from '@iptvflix/api-contracts'
import type { DiscoveryCandidatePoolService } from './discovery-candidate-pool-service.js'

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
}

export class SchedulerService {
  private startupTimer: ReturnType<typeof setTimeout> | null = null
  private sourceSyncTimer: ReturnType<typeof setInterval> | null = null
  private discoveryTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly db: Db,
    private readonly triggerSync: (body: TriggerSyncBody) => Promise<unknown>,
    private readonly discoveryPoolService: DiscoveryCandidatePoolService | null,
    private readonly config: SchedulerConfig,
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
}
