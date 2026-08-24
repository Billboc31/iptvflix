import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  SERIES_BATCH_SIZE: 6,
  SERIES_POOL_MIN: 5,
  SERIES_POOL_TARGET: 25,
  SERIES_SNAPSHOT_TTL_HOURS: 24,
}))

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))
vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../series-pool-service.js', () => ({
  getOrCreateSeriesSession: vi.fn(),
  countUnservedSeries: vi.fn(),
  serveSeriesBatch: vi.fn(),
  buildSeriesDeclaredRails: vi.fn(),
  fillSeriesPool: vi.fn(),
  buildSeriesFallbackShelf: vi.fn(),
}))

vi.mock('../series-snapshot-service.js', () => ({
  getSeriesSnapshot: vi.fn(),
  saveSeriesSnapshot: vi.fn(),
  isSeriesSnapshotValid: vi.fn(),
  isSeriesSnapshotStale: vi.fn(),
}))

vi.mock('../../lib/series-cursor.js', () => ({
  signCursor: vi.fn((_sid: string, pos: number) => `cursor_pos_${pos}`),
  verifyCursor: vi.fn(),
}))

vi.mock('../../db/schema/index.js', () => ({
  recommendationSeriesSessions: {},
  series: {},
  mediaVideos: {},
  shelfInstances: {},
  shelfInstanceItems: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  asc: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p: string | null) => p ? `https://img/${p}` : null),
}))

import { buildSeriesPage } from '../series-page-service.js'
import {
  getOrCreateSeriesSession,
  buildSeriesDeclaredRails,
  fillSeriesPool,
  buildSeriesFallbackShelf,
} from '../series-pool-service.js'
import {
  getSeriesSnapshot,
  saveSeriesSnapshot,
  isSeriesSnapshotValid,
  isSeriesSnapshotStale,
} from '../series-snapshot-service.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'
const INSTANCE_ID_1 = '11111111-0000-0000-0000-000000000001'
const INSTANCE_ID_2 = '11111111-0000-0000-0000-000000000002'

const FRESH_SNAPSHOT = {
  profileId: PROFILE_ID,
  sessionId: SESSION_ID,
  generatedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  declaredShelfInstanceIds: [INSTANCE_ID_1, INSTANCE_ID_2],
  invalidatedAt: null,
}

const STALE_SNAPSHOT = {
  ...FRESH_SNAPSHOT,
  expiresAt: new Date(Date.now() - 1000),
}

function makeSelectChain(resolveWith: unknown[] = []) {
  const prom = Promise.resolve(resolveWith)
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => prom),
    then: prom.then.bind(prom),
    catch: prom.catch.bind(prom),
    finally: prom.finally.bind(prom),
  }
  return chain
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()

  mockDb.select.mockReturnValue(makeSelectChain())

  vi.mocked(getOrCreateSeriesSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null })
  vi.mocked(buildSeriesDeclaredRails).mockResolvedValue({
    shelves: [],
    shelfInstanceIds: [INSTANCE_ID_1, INSTANCE_ID_2],
    nextPoolPosition: 2,
  })
  vi.mocked(fillSeriesPool).mockReturnValue(undefined)
  vi.mocked(buildSeriesFallbackShelf).mockResolvedValue({ id: 'sys_fallback', title: 'Séries populaires', type: 'SYSTEM', layoutHint: 'ROW', items: [] })
  vi.mocked(saveSeriesSnapshot).mockResolvedValue(undefined)

  vi.mocked(getSeriesSnapshot).mockResolvedValue(null)
  vi.mocked(isSeriesSnapshotValid).mockReturnValue(false)
  vi.mocked(isSeriesSnapshotStale).mockReturnValue(false)
})

// ---------------------------------------------------------------------------
// MISS: no snapshot — full generation
// ---------------------------------------------------------------------------

describe('MISS: no snapshot', () => {
  beforeEach(() => {
    vi.mocked(getSeriesSnapshot).mockResolvedValue(null)
  })

  it('calls buildSeriesDeclaredRails (expensive generation)', async () => {
    await buildSeriesPage(PROFILE_ID)
    expect(buildSeriesDeclaredRails).toHaveBeenCalledWith(PROFILE_ID, SESSION_ID)
  })

  it('saves a new snapshot after generation', async () => {
    await buildSeriesPage(PROFILE_ID)
    expect(saveSeriesSnapshot).toHaveBeenCalledWith(
      PROFILE_ID,
      SESSION_ID,
      [INSTANCE_ID_1, INSTANCE_ID_2],
      expect.any(Date),
    )
  })

  it('returns the declared sessionId', async () => {
    const result = await buildSeriesPage(PROFILE_ID)
    expect(result.sessionId).toBe(SESSION_ID)
  })
})

// ---------------------------------------------------------------------------
// HIT: valid snapshot exists — no call to recommendation engine
// ---------------------------------------------------------------------------

describe('HIT: valid snapshot', () => {
  beforeEach(() => {
    vi.mocked(getSeriesSnapshot).mockResolvedValue(FRESH_SNAPSHOT)
    vi.mocked(isSeriesSnapshotValid).mockReturnValue(true)
    vi.mocked(isSeriesSnapshotStale).mockReturnValue(false)

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([
        { id: INSTANCE_ID_1, title: 'Séries pour toi', verticalPosition: 0 },
        { id: INSTANCE_ID_2, title: 'Nouvelles séries pour toi', verticalPosition: 1 },
      ]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]))
  })

  it('does NOT call buildSeriesDeclaredRails (no expensive generation)', async () => {
    await buildSeriesPage(PROFILE_ID)
    expect(buildSeriesDeclaredRails).not.toHaveBeenCalled()
  })

  it('does NOT call saveSeriesSnapshot (snapshot already valid)', async () => {
    await buildSeriesPage(PROFILE_ID)
    expect(saveSeriesSnapshot).not.toHaveBeenCalled()
  })

  it('returns the same sessionId as stored in snapshot', async () => {
    const result = await buildSeriesPage(PROFILE_ID)
    expect(result.sessionId).toBe(SESSION_ID)
  })
})

// ---------------------------------------------------------------------------
// STALE: stale snapshot — serve immediately, trigger async regeneration
// ---------------------------------------------------------------------------

describe('STALE: stale snapshot', () => {
  beforeEach(() => {
    vi.mocked(getSeriesSnapshot).mockResolvedValue(STALE_SNAPSHOT)
    vi.mocked(isSeriesSnapshotValid).mockReturnValue(false)
    vi.mocked(isSeriesSnapshotStale).mockReturnValue(true)

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([
        { id: INSTANCE_ID_1, title: 'Séries pour toi', verticalPosition: 0 },
      ]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]))
  })

  it('does NOT block — returns immediately without waiting for regeneration', async () => {
    const start = Date.now()
    await buildSeriesPage(PROFILE_ID)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(500)
  })

  it('triggers buildSeriesDeclaredRails for async regeneration', async () => {
    await buildSeriesPage(PROFILE_ID)
    await new Promise((r) => setTimeout(r, 0))
    expect(buildSeriesDeclaredRails).toHaveBeenCalled()
  })

  it('triggers fillSeriesPool for background pool replenishment', async () => {
    await buildSeriesPage(PROFILE_ID)
    expect(fillSeriesPool).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// INVALIDATED: explicitly invalidated but not yet expired — treated as MISS
// ---------------------------------------------------------------------------

describe('INVALIDATED: explicit invalidation before expiry', () => {
  it('treats invalidated snapshot as MISS — triggers full regeneration', async () => {
    const invalidatedSnapshot = { ...FRESH_SNAPSHOT, invalidatedAt: new Date() }
    vi.mocked(getSeriesSnapshot).mockResolvedValue(invalidatedSnapshot)
    vi.mocked(isSeriesSnapshotValid).mockReturnValue(false)
    vi.mocked(isSeriesSnapshotStale).mockReturnValue(false)

    await buildSeriesPage(PROFILE_ID)
    expect(buildSeriesDeclaredRails).toHaveBeenCalledWith(PROFILE_ID, SESSION_ID)
    expect(saveSeriesSnapshot).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// No repeated expensive generation on HIT — snapshot reuse verified by mock call count
// ---------------------------------------------------------------------------

describe('no repeated generation on HIT', () => {
  it('a second call within TTL returns the same sessionId and does not trigger buildSeriesDeclaredRails', async () => {
    vi.mocked(getSeriesSnapshot).mockResolvedValue(FRESH_SNAPSHOT)
    vi.mocked(isSeriesSnapshotValid).mockReturnValue(true)
    vi.mocked(isSeriesSnapshotStale).mockReturnValue(false)

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ id: INSTANCE_ID_1, title: 'Séries pour toi', verticalPosition: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValueOnce(makeSelectChain([{ id: INSTANCE_ID_1, title: 'Séries pour toi', verticalPosition: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]))

    const result1 = await buildSeriesPage(PROFILE_ID)
    const result2 = await buildSeriesPage(PROFILE_ID)

    expect(result1.sessionId).toBe(SESSION_ID)
    expect(result2.sessionId).toBe(SESSION_ID)
    expect(buildSeriesDeclaredRails).toHaveBeenCalledTimes(0)
  })
})
