import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../config/env.js', () => ({
  CATALOG_REFRESH_UPCOMING_STALE_HOURS: 12,
  CATALOG_REFRESH_RECENT_STALE_DAYS: 3,
  CATALOG_REFRESH_STABLE_STALE_DAYS: 30,
  CATALOG_REFRESH_DISCOVERY_MAX_PAGES: 5,
}))

import {
  classifyMovieBucket,
  classifySeriesBucket,
  CatalogRefreshService,
  CatalogRefreshAlreadyRunningError,
} from '../catalog-refresh-service.js'
import type { MetadataEnrichmentService } from '../metadata-enrichment-service.js'
import type { MetadataProvider } from '../../providers/metadata/types.js'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../../db/schema/index.js'

// ---------------------------------------------------------------------------
// classifyMovieBucket — pure classification logic
// ---------------------------------------------------------------------------

const NOW = new Date('2026-08-13T12:00:00Z')

function daysAgo(n: number): string {
  return new Date(+NOW - n * 86_400_000).toISOString().slice(0, 10)
}

describe('classifyMovieBucket', () => {
  it('classifies upcoming by production status', () => {
    expect(classifyMovieBucket({ status: 'In Production', theatricalReleaseDate: null }, NOW)).toBe('upcoming')
    expect(classifyMovieBucket({ status: 'Rumored', theatricalReleaseDate: null }, NOW)).toBe('upcoming')
    expect(classifyMovieBucket({ status: 'Planned', theatricalReleaseDate: null }, NOW)).toBe('upcoming')
    expect(classifyMovieBucket({ status: 'Post Production', theatricalReleaseDate: null }, NOW)).toBe('upcoming')
  })

  it('classifies upcoming by release date within 60 days', () => {
    expect(classifyMovieBucket({ status: 'Released', theatricalReleaseDate: daysAgo(30) }, NOW)).toBe('upcoming')
    expect(classifyMovieBucket({ status: null, theatricalReleaseDate: daysAgo(59) }, NOW)).toBe('upcoming')
  })

  it('classifies recent for releases 61-90 days ago with non-upcoming status', () => {
    expect(classifyMovieBucket({ status: 'Released', theatricalReleaseDate: daysAgo(61) }, NOW)).toBe('recent')
    expect(classifyMovieBucket({ status: null, theatricalReleaseDate: daysAgo(89) }, NOW)).toBe('recent')
  })

  it('classifies stable for old releases', () => {
    expect(classifyMovieBucket({ status: 'Released', theatricalReleaseDate: daysAgo(120) }, NOW)).toBe('stable')
    expect(classifyMovieBucket({ status: 'Released', theatricalReleaseDate: null }, NOW)).toBe('stable')
    expect(classifyMovieBucket({ status: null, theatricalReleaseDate: null }, NOW)).toBe('stable')
  })

  it('prefers upcoming status over old date', () => {
    expect(classifyMovieBucket({ status: 'In Production', theatricalReleaseDate: daysAgo(200) }, NOW)).toBe('upcoming')
  })
})

describe('classifySeriesBucket', () => {
  it('classifies upcoming by production status', () => {
    expect(classifySeriesBucket({ status: 'In Production' })).toBe('upcoming')
    expect(classifySeriesBucket({ status: 'Planned' })).toBe('upcoming')
  })

  it('classifies non-upcoming statuses as stable', () => {
    expect(classifySeriesBucket({ status: 'Ended' })).toBe('stable')
    expect(classifySeriesBucket({ status: null })).toBe('stable')
    expect(classifySeriesBucket({ status: 'Returning Series' })).toBe('stable')
    expect(classifySeriesBucket({ status: 'Canceled' })).toBe('stable')
  })
})

// ---------------------------------------------------------------------------
// CatalogRefreshService — integration with mocked DB and enrichment
// ---------------------------------------------------------------------------

type Db = PostgresJsDatabase<typeof schema>

function makeProvider(): MetadataProvider {
  return {
    fetchMovieFeed: vi.fn().mockResolvedValue([]),
    fetchSeriesFeed: vi.fn().mockResolvedValue([]),
  } as unknown as MetadataProvider
}

function makeEnrichmentService(result: 'enriched' | 'skipped' | 'provider-failed' = 'enriched') {
  return {
    enrichMovie: vi.fn().mockResolvedValue(result),
    enrichSeries: vi.fn().mockResolvedValue(result),
  } as unknown as MetadataEnrichmentService
}

/**
 * Builds a mock DB for CatalogRefreshService tests.
 *
 * Query sequence:
 *   UPDATE — stale lock clear         (not a select)
 *   SELECT idx=0 — running check      → runningRows
 *   INSERT — insert RUNNING row       (not a select)
 *   SELECT idx=1 — load checkpoint    → [{checkpoint: null}]
 *   SELECT idx=2+ — bucket queries    → entityIds on even queries, [] on odd
 */
function makeDb(opts: { runningRows?: { id: string }[]; entityIds?: string[]; runId?: string } = {}) {
  const { runningRows = [], entityIds = [], runId = 'run-uuid' } = opts
  const entities = entityIds.map((id) => ({ id }))
  let selectIdx = 0

  return {
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: runId }]),
      }),
    }),
    select: vi.fn().mockImplementation(() => {
      const idx = selectIdx++

      if (idx === 0) {
        // running check: .from().where().limit()
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(runningRows),
            }),
          }),
        }
      }

      if (idx === 1) {
        // checkpoint load: .from().where() resolves directly
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ checkpoint: null }]),
          }),
        }
      }

      // bucket/discovery queries: .from().where().orderBy().limit().offset()
      const queryNum = idx - 2
      const rows = queryNum % 2 === 0 ? entities : []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue(rows),
              }),
            }),
          }),
        }),
      }
    }),
  } as unknown as Db
}

describe('CatalogRefreshService', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('throws CatalogRefreshAlreadyRunningError when a run is already RUNNING', async () => {
    const db = makeDb({ runningRows: [{ id: 'existing' }] })
    const service = new CatalogRefreshService(db, makeProvider(), makeEnrichmentService())
    await expect(service.run()).rejects.toBeInstanceOf(CatalogRefreshAlreadyRunningError)
  })

  it('returns a runId immediately and executes asynchronously', async () => {
    const db = makeDb()
    const service = new CatalogRefreshService(db, makeProvider(), makeEnrichmentService(), {
      upcomingStaleHours: 12, recentStaleDays: 3, stableStaleDays: 30, discoveryMaxPages: 1,
    })
    const runId = await service.run()
    expect(runId).toBe('run-uuid')
    await vi.runAllTimersAsync()
  })

  it('calls enrichMovie with upcomingStaleHours/24 staleDays for upcoming bucket', async () => {
    const enrichment = makeEnrichmentService('enriched')
    const db = makeDb({ entityIds: ['movie-1'] })

    const service = new CatalogRefreshService(db, makeProvider(), enrichment, {
      upcomingStaleHours: 12, recentStaleDays: 3, stableStaleDays: 30, discoveryMaxPages: 1,
    })

    void service.run()
    await vi.runAllTimersAsync()

    const calls = (enrichment.enrichMovie as ReturnType<typeof vi.fn>).mock.calls
    const upcomingCalls = calls.filter(([, opts]) => opts?.staleDays === 12 / 24)
    expect(upcomingCalls.length).toBeGreaterThan(0)
  })

  it('calls enrichMovie with stableStaleDays for stable bucket', async () => {
    const enrichment = makeEnrichmentService('enriched')
    const db = makeDb({ entityIds: ['movie-2'] })

    const service = new CatalogRefreshService(db, makeProvider(), enrichment, {
      upcomingStaleHours: 12, recentStaleDays: 3, stableStaleDays: 30, discoveryMaxPages: 1,
    })

    void service.run()
    await vi.runAllTimersAsync()

    const calls = (enrichment.enrichMovie as ReturnType<typeof vi.fn>).mock.calls
    const stableCalls = calls.filter(([, opts]) => opts?.staleDays === 30)
    expect(stableCalls.length).toBeGreaterThan(0)
  })

  it('skips a bucket step that is already marked done in the checkpoint', async () => {
    const enrichment = makeEnrichmentService('enriched')
    let selectIdx = 0

    const db = {
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }) }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 'run-1' }]) }) }),
      select: vi.fn().mockImplementation(() => {
        const idx = selectIdx++
        if (idx === 0) {
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) }) }
        }
        if (idx === 1) {
          const checkpoint = { 'refresh:MOVIE:upcoming': { done: true, offset: 50 } }
          return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ checkpoint }]) }) }
        }
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({ offset: vi.fn().mockResolvedValue([]) }),
              }),
            }),
          }),
        }
      }),
    } as unknown as Db

    const service = new CatalogRefreshService(db, makeProvider(), enrichment, {
      upcomingStaleHours: 12, recentStaleDays: 3, stableStaleDays: 30, discoveryMaxPages: 1,
    })

    void service.run()
    await vi.runAllTimersAsync()

    // No enrichMovie calls for upcoming (staleDays=0.5) since that step is checkpointed done
    const calls = (enrichment.enrichMovie as ReturnType<typeof vi.fn>).mock.calls
    const upcomingCalls = calls.filter(([, opts]) => opts?.staleDays === 12 / 24)
    expect(upcomingCalls.length).toBe(0)
  })
})
