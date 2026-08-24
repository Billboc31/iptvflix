import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  HOME_CURSOR_SECRET: 'test-secret',
  HOME_BATCH_SIZE: 6,
  HOME_ITEMS_PER_SHELF: 24,
  HOME_ITEMS_MAX: 30,
  HOME_POOL_MIN: 10,
  HOME_POOL_TARGET: 25,
  HOME_SESSION_TTL_HOURS: 24,
  HOME_SNAPSHOT_TTL_HOURS: 24,
  HERO_MIN_SCORE: 0.55,
}))

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))
vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../home-pool-service.js', () => ({
  getOrCreateSession: vi.fn(),
  countUnserved: vi.fn(),
  serveBatch: vi.fn(),
  buildDeclaredRails: vi.fn(),
  fillPool: vi.fn(),
  buildFallbackShelf: vi.fn(),
}))

vi.mock('../home-snapshot-service.js', () => ({
  getSnapshot: vi.fn(),
  saveSnapshot: vi.fn(),
  isSnapshotValid: vi.fn(),
  isStale: vi.fn(),
}))

vi.mock('../shelf-service.js', () => ({
  getShelf: vi.fn(),
}))

vi.mock('../../lib/home-cursor.js', () => ({
  signCursor: vi.fn((_sid: string, pos: number) => `cursor_pos_${pos}`),
  verifyCursor: vi.fn(),
}))

vi.mock('../../db/schema/index.js', () => ({
  recommendationHomeSessions: {},
  movies: {},
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

import { buildHome } from '../home-service.js'
import {
  getOrCreateSession,
  buildDeclaredRails,
  fillPool,
  buildFallbackShelf,
} from '../home-pool-service.js'
import {
  getSnapshot,
  saveSnapshot,
  isSnapshotValid,
  isStale,
} from '../home-snapshot-service.js'
import { getShelf } from '../shelf-service.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const PROFILE_ID_B = '00000000-0000-0000-0000-000000000002'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'
const INSTANCE_ID_1 = '11111111-0000-0000-0000-000000000001'
const INSTANCE_ID_2 = '11111111-0000-0000-0000-000000000002'

const POUR_TOI: ShelfResponse = {
  id: INSTANCE_ID_1,
  title: 'Pour toi',
  type: 'GENERATED',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'movie-01', title: 'Film 1', posterUrl: null }],
}

const NOUVEAUTES: ShelfResponse = {
  id: INSTANCE_ID_2,
  title: 'Nouveautés pour toi',
  type: 'GENERATED',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'movie-02', title: 'Film 2', posterUrl: null }],
}

const FALLBACK_SHELF: ShelfResponse = {
  id: 'sys_fallback_popular',
  title: 'Films populaires',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'fallback-01', title: 'Fallback Film', posterUrl: null }],
}

const FRESH_SNAPSHOT = {
  id: 'snap-1',
  profileId: PROFILE_ID,
  sessionId: SESSION_ID,
  generatedAt: new Date(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  declaredShelfInstanceIds: [INSTANCE_ID_1, INSTANCE_ID_2],
  heroMediaId: null,
  heroMediaType: null,
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

function makeInsertChain() {
  const chain: Record<string, unknown> = {
    values: vi.fn(() => chain),
    onConflictDoUpdate: vi.fn(() => Promise.resolve()),
  }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()

  mockDb.select.mockReturnValue(makeSelectChain())
  mockDb.insert.mockReturnValue(makeInsertChain())

  vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null })
  vi.mocked(buildDeclaredRails).mockResolvedValue({
    shelves: [POUR_TOI, NOUVEAUTES],
    nextPoolPosition: 2,
    shelfInstanceIds: [INSTANCE_ID_1, INSTANCE_ID_2],
    hero: null,
  })
  vi.mocked(fillPool).mockReturnValue(undefined)
  vi.mocked(buildFallbackShelf).mockResolvedValue(FALLBACK_SHELF)
  vi.mocked(saveSnapshot).mockResolvedValue(undefined)
  vi.mocked(getShelf).mockResolvedValue({ id: 'sys_continue_watching', title: 'Continuer à regarder', type: 'SYSTEM', layoutHint: 'ROW', items: [] })

  vi.mocked(getSnapshot).mockResolvedValue(null)
  vi.mocked(isSnapshotValid).mockReturnValue(false)
  vi.mocked(isStale).mockReturnValue(false)
})

// ---------------------------------------------------------------------------
// MISS: no snapshot — full generation
// ---------------------------------------------------------------------------

describe('MISS: no snapshot', () => {
  beforeEach(() => {
    vi.mocked(getSnapshot).mockResolvedValue(null)
  })

  it('calls buildDeclaredRails (expensive generation)', async () => {
    await buildHome(PROFILE_ID)
    expect(buildDeclaredRails).toHaveBeenCalledWith(PROFILE_ID, SESSION_ID)
  })

  it('saves a new snapshot after generation', async () => {
    await buildHome(PROFILE_ID)
    expect(saveSnapshot).toHaveBeenCalledWith(
      PROFILE_ID,
      SESSION_ID,
      [INSTANCE_ID_1, INSTANCE_ID_2],
      expect.any(Date),
      null,
      null,
    )
  })

  it('returns the declared shelves', async () => {
    const result = await buildHome(PROFILE_ID)
    expect(result.shelves.some((s) => s.title === 'Pour toi')).toBe(true)
  })

  it('returns hero from buildDeclaredRails', async () => {
    const mockHero = { mediaId: 'movie-hero', mediaType: 'MOVIE' as const, title: 'Hero Film', synopsis: null, backdropUrl: 'https://img/bd.jpg', availabilityStatus: 'available', trailerKey: null }
    vi.mocked(buildDeclaredRails).mockResolvedValue({
      shelves: [POUR_TOI],
      nextPoolPosition: 1,
      shelfInstanceIds: [INSTANCE_ID_1],
      hero: mockHero,
    })
    const result = await buildHome(PROFILE_ID)
    expect(result.hero).toEqual(mockHero)
  })
})

// ---------------------------------------------------------------------------
// HIT: valid snapshot exists — no call to recommendation engine
// ---------------------------------------------------------------------------

describe('HIT: valid snapshot', () => {
  beforeEach(() => {
    vi.mocked(getSnapshot).mockResolvedValue(FRESH_SNAPSHOT)
    vi.mocked(isSnapshotValid).mockReturnValue(true)
    vi.mocked(isStale).mockReturnValue(false)

    // Simulate DB returning shelf_instances rows
    mockDb.select
      .mockReturnValueOnce(makeSelectChain([
        { id: INSTANCE_ID_1, title: 'Pour toi', verticalPosition: 0 },
        { id: INSTANCE_ID_2, title: 'Nouveautés pour toi', verticalPosition: 1 },
      ]))
      .mockReturnValueOnce(makeSelectChain([
        { shelfInstanceId: INSTANCE_ID_1, mediaType: 'MOVIE', mediaId: 'movie-01', rankPosition: 0 },
      ]))
      .mockReturnValue(makeSelectChain([]))
  })

  it('does NOT call buildDeclaredRails (no expensive generation)', async () => {
    await buildHome(PROFILE_ID)
    expect(buildDeclaredRails).not.toHaveBeenCalled()
  })

  it('does NOT call saveSnapshot (snapshot already valid)', async () => {
    await buildHome(PROFILE_ID)
    expect(saveSnapshot).not.toHaveBeenCalled()
  })

  it('returns shelves from snapshot', async () => {
    const result = await buildHome(PROFILE_ID)
    expect(result.sessionId).toBe(SESSION_ID)
  })
})

// ---------------------------------------------------------------------------
// STALE: stale snapshot — serve immediately, trigger async regeneration
// ---------------------------------------------------------------------------

describe('STALE: stale snapshot', () => {
  beforeEach(() => {
    vi.mocked(getSnapshot).mockResolvedValue(STALE_SNAPSHOT)
    vi.mocked(isSnapshotValid).mockReturnValue(false)
    vi.mocked(isStale).mockReturnValue(true)

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([
        { id: INSTANCE_ID_1, title: 'Pour toi', verticalPosition: 0 },
      ]))
      .mockReturnValueOnce(makeSelectChain([
        { shelfInstanceId: INSTANCE_ID_1, mediaType: 'MOVIE', mediaId: 'movie-01', rankPosition: 0 },
      ]))
      .mockReturnValue(makeSelectChain([]))
  })

  it('does NOT block — returns immediately without waiting for regeneration', async () => {
    const start = Date.now()
    await buildHome(PROFILE_ID)
    const elapsed = Date.now() - start
    // Should complete almost instantly (< 500ms) even if regen is slow
    expect(elapsed).toBeLessThan(500)
  })

  it('triggers buildDeclaredRails for async regeneration', async () => {
    await buildHome(PROFILE_ID)
    // Wait a tick for fire-and-forget to start
    await new Promise((r) => setTimeout(r, 0))
    expect(buildDeclaredRails).toHaveBeenCalled()
  })

  it('triggers fillPool for background pool replenishment', async () => {
    await buildHome(PROFILE_ID)
    expect(fillPool).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Per-profile isolation
// ---------------------------------------------------------------------------

describe('per-profile isolation', () => {
  it('snapshot for profile A does not affect profile B — different getSnapshot calls', async () => {
    vi.mocked(getSnapshot)
      .mockResolvedValueOnce(FRESH_SNAPSHOT)  // profile A: has snapshot
      .mockResolvedValueOnce(null)            // profile B: no snapshot

    vi.mocked(isSnapshotValid).mockReturnValueOnce(true).mockReturnValue(false)

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ id: INSTANCE_ID_1, title: 'Pour toi', verticalPosition: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]))

    // Profile A — HIT
    await buildHome(PROFILE_ID)
    expect(buildDeclaredRails).not.toHaveBeenCalled()

    vi.clearAllMocks()
    vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID_B, cursorReference: null })
    vi.mocked(getSnapshot).mockResolvedValue(null)
    vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [POUR_TOI], nextPoolPosition: 1, shelfInstanceIds: [INSTANCE_ID_1], hero: null })
    vi.mocked(saveSnapshot).mockResolvedValue(undefined)
    vi.mocked(fillPool).mockReturnValue(undefined)

    // Profile B — MISS triggers generation
    await buildHome(PROFILE_ID_B)
    expect(buildDeclaredRails).toHaveBeenCalledWith(PROFILE_ID_B, SESSION_ID)
  })
})

// ---------------------------------------------------------------------------
// No repeated expensive generation on HIT
// ---------------------------------------------------------------------------

describe('no repeated generation on HIT', () => {
  it('buildDeclaredRails call count is 0 on HIT path', async () => {
    vi.mocked(getSnapshot).mockResolvedValue(FRESH_SNAPSHOT)
    vi.mocked(isSnapshotValid).mockReturnValue(true)

    mockDb.select
      .mockReturnValueOnce(makeSelectChain([{ id: INSTANCE_ID_1, title: 'Pour toi', verticalPosition: 0 }]))
      .mockReturnValueOnce(makeSelectChain([]))
      .mockReturnValue(makeSelectChain([]))

    await buildHome(PROFILE_ID)
    await buildHome(PROFILE_ID)
    await buildHome(PROFILE_ID)

    expect(buildDeclaredRails).toHaveBeenCalledTimes(0)
  })
})
