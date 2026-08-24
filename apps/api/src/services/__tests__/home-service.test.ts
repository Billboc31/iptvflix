import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted so imports resolve correctly)
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
  signCursor: vi.fn((_sessionId: string, pos: number) => `cursor_pos_${pos}`),
  verifyCursor: vi.fn(),
}))

vi.mock('../../db/schema/index.js', () => ({
  recommendationHomeSessions: {},
  movies: {},
  series: {},
  mediaVideos: {},
  shelfInstances: {},
  shelfInstanceItems: {},
  homeDiscoverySnapshots: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
  asc: vi.fn(),
  isNull: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p) => p ? `https://img/${p}` : null),
}))

import { buildHome } from '../home-service.js'
import {
  getOrCreateSession,
  countUnserved,
  serveBatch,
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
import { signCursor, verifyCursor } from '../../lib/home-cursor.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'

const POUR_TOI: ShelfResponse = {
  id: 'instance-pour-toi',
  title: 'Pour toi',
  type: 'GENERATED',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'movie-01', title: 'Film 1', posterUrl: null }],
}

const NOUVEAUTES: ShelfResponse = {
  id: 'instance-nouveautes',
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

function makeBatchRow(pos: number) {
  return {
    instanceId: `inst-${pos}`,
    title: `Shelf ${pos}`,
    verticalPosition: pos,
    items: [{ mediaType: 'MOVIE', mediaId: `media-${pos}` }],
  }
}

// ---------------------------------------------------------------------------
// Setup helpers
// ---------------------------------------------------------------------------

function makeChain(resolveWith: unknown[] = []) {
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

beforeEach(() => {
  vi.clearAllMocks()
  mockDb.select.mockReturnValue(makeChain())
  vi.mocked(signCursor).mockImplementation((_sid: string, pos: number) => `cursor_pos_${pos}`)

  vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null })
  vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [POUR_TOI, NOUVEAUTES], nextPoolPosition: 2, shelfInstanceIds: ['inst-pt', 'inst-nv'], hero: null })
  vi.mocked(fillPool).mockReturnValue(undefined)
  vi.mocked(buildFallbackShelf).mockResolvedValue(FALLBACK_SHELF)
  vi.mocked(saveSnapshot).mockResolvedValue(undefined)
  vi.mocked(getShelf).mockResolvedValue({ id: 'sys_continue_watching', title: 'Continuer à regarder', type: 'SYSTEM', layoutHint: 'ROW', items: [] })

  // Default: no snapshot (MISS path) so declared rails are built
  vi.mocked(getSnapshot).mockResolvedValue(null)
  vi.mocked(isSnapshotValid).mockReturnValue(false)
  vi.mocked(isStale).mockReturnValue(false)

  vi.mocked(countUnserved).mockResolvedValue(12)
  vi.mocked(serveBatch).mockResolvedValue({
    shelves: [makeBatchRow(0), makeBatchRow(1)],
    newNextPosition: 2,
    hasMore: true,
  })
})

// ---------------------------------------------------------------------------
// First request — declared rails
// ---------------------------------------------------------------------------

describe('first request — declared rails', () => {
  it('returns sessionId, declared shelves, and nextCursor', async () => {
    const result = await buildHome(PROFILE_ID)
    expect(result.sessionId).toBe(SESSION_ID)
    expect(result.shelves).toHaveLength(2)
    expect(result.nextCursor).toBe('cursor_pos_2')
  })

  it('first response contains declared rails in the order they were returned', async () => {
    const result = await buildHome(PROFILE_ID)
    expect(result.shelves[0].title).toBe('Pour toi')
    expect(result.shelves[1].title).toBe('Nouveautés pour toi')
  })

  it('coldStart is false when buildDeclaredRails returns at least one shelf', async () => {
    const result = await buildHome(PROFILE_ID)
    expect(result.coldStart).toBe(false)
  })

  it('coldStart is true and returns fallback shelf when buildDeclaredRails returns empty array', async () => {
    vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [], nextPoolPosition: 0, shelfInstanceIds: [], hero: null })
    const result = await buildHome(PROFILE_ID)
    expect(result.coldStart).toBe(true)
    expect(result.shelves.some((s) => s.id === 'sys_fallback_popular')).toBe(true)
  })

  it('error in buildDeclaredRails falls back to fallback shelf without throwing', async () => {
    vi.mocked(buildDeclaredRails).mockRejectedValue(new Error('engine down'))
    const result = await buildHome(PROFILE_ID)
    expect(result.coldStart).toBe(true)
    expect(result.shelves.some((s) => s.id === 'sys_fallback_popular')).toBe(true)
  })

  it('always triggers async fillPool after declared rails', async () => {
    await buildHome(PROFILE_ID)
    expect(fillPool).toHaveBeenCalledWith(SESSION_ID, PROFILE_ID, 25)
  })

  it('nextCursor points to nextPoolPosition from buildDeclaredRails', async () => {
    vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [POUR_TOI], nextPoolPosition: 1, shelfInstanceIds: ['instance-pour-toi'], hero: null })
    const result = await buildHome(PROFILE_ID)
    expect(result.nextCursor).toBe('cursor_pos_1')
  })

  it('nextCursor is null when session is exhausted', async () => {
    vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: 'exhausted' })
    const result = await buildHome(PROFILE_ID)
    expect(result.nextCursor).toBeNull()
  })

  it('nextCursor is null when all declared rails are empty (coldStart with fallback)', async () => {
    vi.mocked(buildDeclaredRails).mockResolvedValue({ shelves: [], nextPoolPosition: 0, shelfInstanceIds: [], hero: null })
    vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: 'exhausted' })
    const result = await buildHome(PROFILE_ID)
    expect(result.nextCursor).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Cursor request
// ---------------------------------------------------------------------------

describe('cursor request', () => {
  beforeEach(() => {
    vi.mocked(verifyCursor).mockReturnValue({ sessionId: SESSION_ID, nextPosition: 6 })
    mockDb.select
      .mockReturnValueOnce(makeChain([{ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null }]))
      .mockReturnValue(makeChain([]))
  })

  it('returns the next batch under the same sessionId', async () => {
    vi.mocked(serveBatch).mockResolvedValue({
      shelves: [makeBatchRow(6), makeBatchRow(7)],
      newNextPosition: 8,
      hasMore: true,
    })
    const result = await buildHome(PROFILE_ID, 'cursor_pos_6')
    expect(result.sessionId).toBe(SESSION_ID)
    expect(result.coldStart).toBe(false)
    expect(result.shelves).toHaveLength(2)
    expect(result.nextCursor).toBe('cursor_pos_8')
  })

  it('returns 403 for an invalid cursor', async () => {
    vi.mocked(verifyCursor).mockReturnValue(null)
    await expect(buildHome(PROFILE_ID, 'bad-cursor')).rejects.toMatchObject({ status: 403 })
  })

  it('returns 403 when session profileId mismatches', async () => {
    mockDb.select.mockReset()
    mockDb.select
      .mockReturnValueOnce(makeChain([{ id: SESSION_ID, profileId: 'other-profile', cursorReference: null }]))
      .mockReturnValue(makeChain([]))
    await expect(buildHome(PROFILE_ID, 'cursor_pos_6')).rejects.toMatchObject({ status: 403 })
  })

  it('triggers async replenishment when pool runs low after cursor batch', async () => {
    vi.mocked(countUnserved).mockResolvedValue(3)
    vi.mocked(serveBatch).mockResolvedValue({ shelves: [makeBatchRow(6)], newNextPosition: 7, hasMore: true })
    await buildHome(PROFILE_ID, 'cursor_pos_6')
    expect(fillPool).toHaveBeenCalledWith(SESSION_ID, PROFILE_ID, 25)
  })

  it('sets nextCursor to null when hasMore is false', async () => {
    vi.mocked(serveBatch).mockResolvedValue({ shelves: [makeBatchRow(6)], newNextPosition: 7, hasMore: false })
    const result = await buildHome(PROFILE_ID, 'cursor_pos_6')
    expect(result.nextCursor).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Shelf item count
// ---------------------------------------------------------------------------

describe('shelf item count', () => {
  it('shelf from batch has items bounded by HOME_ITEMS_PER_SHELF (mocked serveBatch)', async () => {
    const manyItems = Array.from({ length: 24 }, (_, i) => ({ mediaType: 'MOVIE', mediaId: `m-${i}` }))
    vi.mocked(serveBatch).mockResolvedValue({
      shelves: [{ instanceId: 'i1', title: 'T', verticalPosition: 0, items: manyItems }],
      newNextPosition: 1,
      hasMore: false,
    })
    vi.mocked(countUnserved).mockResolvedValue(24)
    vi.mocked(verifyCursor).mockReturnValue({ sessionId: SESSION_ID, nextPosition: 0 })
    mockDb.select.mockReset()
    mockDb.select
      .mockReturnValueOnce(makeChain([{ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null }]))
      .mockReturnValue(makeChain([]))
    const result = await buildHome(PROFILE_ID, 'cursor_pos_0')
    const shelf = result.shelves.find((s) => s.id === 'i1')
    expect(shelf?.items).toHaveLength(24)
  })
})
