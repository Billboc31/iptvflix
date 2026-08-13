import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SchedulerService } from '../scheduler-service.js'
import type { DiscoveryCandidatePoolService } from '../discovery-candidate-pool-service.js'

// ---------------------------------------------------------------------------
// Mock DB builder
// ---------------------------------------------------------------------------

type MockSource = {
  id: string
  name: string
  type: string
  baseUrl: string
  username: string | null
  password: string | null
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

function makeSource(id: string): MockSource {
  return {
    id,
    name: `Source ${id}`,
    type: 'XTREAM',
    baseUrl: 'http://example.com',
    username: 'u',
    password: 'p',
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

/**
 * Builds a mock Drizzle DB where:
 * - The first select() call is the sources query → resolves to `enabledSources`
 * - Subsequent select() calls are sync run queries (one per source, in task creation order)
 *   → each resolves to [{ completedAt }] or [] depending on `completedAts[i]`
 */
function makeDb(enabledSources: MockSource[], completedAts: (Date | null)[]) {
  let selectCallIdx = 0

  return {
    select: vi.fn().mockImplementation(() => {
      const idx = selectCallIdx++
      if (idx === 0) {
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(enabledSources),
          }),
        }
      }
      const sourceIdx = idx - 1
      const completedAt = completedAts[sourceIdx] ?? null
      const result = completedAt !== null ? [{ completedAt }] : []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(result),
            }),
          }),
        }),
      }
    }),
  }
}

// ---------------------------------------------------------------------------
// Mock discovery pool service
// ---------------------------------------------------------------------------

function makeDiscoveryPoolService(): DiscoveryCandidatePoolService {
  return {
    evictStale: vi.fn().mockResolvedValue(0),
    refreshPool: vi.fn().mockResolvedValue(undefined),
    materializeCandidate: vi.fn(),
  } as unknown as DiscoveryCandidatePoolService
}

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

const BASE_CONFIG = {
  enabled: true,
  sourceSyncCadenceMinutes: 60,
  discoveryCadenceMinutes: 360,
  sourceSyncConcurrency: 2,
  startupDelayMs: 1000,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  describe('disabled scheduling', () => {
    it('does not set up timers or call triggerSync when enabled=false', async () => {
      const triggerSync = vi.fn()
      const db = makeDb([makeSource('a')], [null])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        null,
        { ...BASE_CONFIG, enabled: false },
      )
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 10_000)
      expect(triggerSync).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  describe('cadence gate', () => {
    it('skips a source synced within the cadence window', async () => {
      const triggerSync = vi.fn().mockResolvedValue({})
      const recentlyCompleted = new Date(Date.now() - 30 * 60_000) // 30 min ago < 60 min cadence
      const db = makeDb([makeSource('a')], [recentlyCompleted])
      const scheduler = new SchedulerService(db as never, triggerSync, null, BASE_CONFIG)
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      expect(triggerSync).not.toHaveBeenCalled()
      scheduler.stop()
    })

    it('syncs a source whose last completedAt is older than the cadence', async () => {
      const triggerSync = vi.fn().mockResolvedValue({})
      const staleCompleted = new Date(Date.now() - 90 * 60_000) // 90 min ago > 60 min cadence
      const db = makeDb([makeSource('a')], [staleCompleted])
      const scheduler = new SchedulerService(db as never, triggerSync, null, BASE_CONFIG)
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      expect(triggerSync).toHaveBeenCalledOnce()
      expect(triggerSync).toHaveBeenCalledWith({ sourceId: 'a' })
      scheduler.stop()
    })

    it('syncs a source with no previous completed run', async () => {
      const triggerSync = vi.fn().mockResolvedValue({})
      const db = makeDb([makeSource('a')], [null])
      const scheduler = new SchedulerService(db as never, triggerSync, null, BASE_CONFIG)
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      expect(triggerSync).toHaveBeenCalledOnce()
      scheduler.stop()
    })
  })

  // -------------------------------------------------------------------------
  describe('lock contention', () => {
    it('silently skips a source with statusCode 409 and continues remaining sources', async () => {
      const conflictErr = Object.assign(new Error('already running'), { statusCode: 409 })
      const triggerSync = vi.fn()
        .mockRejectedValueOnce(conflictErr)
        .mockResolvedValue({})
      const sources = [makeSource('a'), makeSource('b'), makeSource('c')]
      const db = makeDb(sources, [null, null, null])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        null,
        { ...BASE_CONFIG, sourceSyncConcurrency: 1 },
      )
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      // All 3 sources attempted; the 409 is swallowed for source A
      expect(triggerSync).toHaveBeenCalledTimes(3)
      scheduler.stop()
    })
  })

  // -------------------------------------------------------------------------
  describe('failure isolation', () => {
    it('logs the error for a failing source and continues other sources', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const networkErr = new Error('network error')
      const triggerSync = vi.fn()
        .mockRejectedValueOnce(networkErr) // source A fails
        .mockResolvedValue({})              // sources B and C succeed
      const sources = [makeSource('a'), makeSource('b'), makeSource('c')]
      const db = makeDb(sources, [null, null, null])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        null,
        { ...BASE_CONFIG, sourceSyncConcurrency: 1 },
      )
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      expect(triggerSync).toHaveBeenCalledTimes(3)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('a'),
        networkErr,
      )
      scheduler.stop()
    })
  })

  // -------------------------------------------------------------------------
  describe('concurrency bound', () => {
    it('calls triggerSync for all 3 stale sources with concurrency=1', async () => {
      const triggerSync = vi.fn().mockResolvedValue({})
      const sources = [makeSource('a'), makeSource('b'), makeSource('c')]
      const db = makeDb(sources, [null, null, null])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        null,
        { ...BASE_CONFIG, sourceSyncConcurrency: 1 },
      )
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      expect(triggerSync).toHaveBeenCalledTimes(3)
      expect(triggerSync).toHaveBeenCalledWith({ sourceId: 'a' })
      expect(triggerSync).toHaveBeenCalledWith({ sourceId: 'b' })
      expect(triggerSync).toHaveBeenCalledWith({ sourceId: 'c' })
      scheduler.stop()
    })
  })

  // -------------------------------------------------------------------------
  describe('restart safety', () => {
    it('fires no triggerSync calls before the startup delay elapses', async () => {
      const triggerSync = vi.fn().mockResolvedValue({})
      const db = makeDb([makeSource('a')], [null])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        null,
        { ...BASE_CONFIG, startupDelayMs: 5000 },
      )
      scheduler.start()
      await vi.advanceTimersByTimeAsync(4999)
      expect(triggerSync).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(triggerSync).toHaveBeenCalled()
      scheduler.stop()
    })

    it('stop() clears the startup timer so no tick fires after stop', async () => {
      const triggerSync = vi.fn()
      const db = makeDb([makeSource('a')], [null])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        null,
        { ...BASE_CONFIG, startupDelayMs: 5000 },
      )
      scheduler.start()
      scheduler.stop()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(triggerSync).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  describe('discovery tick', () => {
    it('calls evictStale and refreshPool after the startup delay', async () => {
      const triggerSync = vi.fn()
      const discoveryPoolService = makeDiscoveryPoolService()
      const db = makeDb([], [])
      const scheduler = new SchedulerService(
        db as never,
        triggerSync,
        discoveryPoolService,
        BASE_CONFIG,
      )
      scheduler.start()
      await vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100)
      expect(discoveryPoolService.evictStale).toHaveBeenCalled()
      expect(discoveryPoolService.refreshPool).toHaveBeenCalled()
      scheduler.stop()
    })

    it('catches discovery tick errors without rethrowing', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const discoveryPoolService = makeDiscoveryPoolService()
      vi.mocked(discoveryPoolService.evictStale as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('db error'),
      )
      const db = makeDb([], [])
      const scheduler = new SchedulerService(
        db as never,
        vi.fn(),
        discoveryPoolService,
        BASE_CONFIG,
      )
      scheduler.start()
      await expect(
        vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100),
      ).resolves.not.toThrow()
      scheduler.stop()
    })
  })

  // -------------------------------------------------------------------------
  describe('no discovery service', () => {
    it('discovery tick is a no-op when discoveryPoolService is null', async () => {
      const db = makeDb([], [])
      const scheduler = new SchedulerService(db as never, vi.fn(), null, BASE_CONFIG)
      scheduler.start()
      // should not throw
      await expect(
        vi.advanceTimersByTimeAsync(BASE_CONFIG.startupDelayMs + 100),
      ).resolves.not.toThrow()
      scheduler.stop()
    })
  })
})
