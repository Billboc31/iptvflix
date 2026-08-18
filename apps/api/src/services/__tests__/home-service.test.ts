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
}))

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))
vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../home-pool-service.js', () => ({
  getOrCreateSession: vi.fn(),
  countUnserved: vi.fn(),
  serveBatch: vi.fn(),
  buildFixedShelves: vi.fn(),
  fillPool: vi.fn(),
  fillPoolAsync: vi.fn(),
  buildFallbackShelf: vi.fn(),
  persistFixedShelvesForSession: vi.fn(),
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
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  inArray: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p) => p ? `https://img/${p}` : null),
}))

import { buildHome } from '../home-service.js'
import {
  getOrCreateSession,
  countUnserved,
  serveBatch,
  buildFixedShelves,
  fillPool,
  fillPoolAsync,
  buildFallbackShelf,
  persistFixedShelvesForSession,
} from '../home-pool-service.js'
import { signCursor, verifyCursor } from '../../lib/home-cursor.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'

const EMPTY_FIXED: ShelfResponse[] = []
const CONTINUE_WATCHING: ShelfResponse = {
  id: 'sys_continue_watching',
  title: 'Continuer à regarder',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'movie-01', title: 'Film en cours', posterUrl: null }],
}
const MY_LIST: ShelfResponse = {
  id: 'sys_my_list',
  title: 'Ma liste',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'movie-02', title: 'Film liste', posterUrl: null }],
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
  // Returns a chain mock that is both chainable AND thenable so it can be
  // awaited at any depth of chaining (e.g. .from().where() without .limit()).
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
  // Restore implementations cleared by clearAllMocks on module-level mocks.
  vi.mocked(signCursor).mockImplementation((_sid: string, pos: number) => `cursor_pos_${pos}`)

  // Default: active session with non-exhausted cursorReference.
  vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null })
  vi.mocked(buildFixedShelves).mockResolvedValue(EMPTY_FIXED)
  vi.mocked(countUnserved).mockResolvedValue(12) // pool not empty
  vi.mocked(fillPool).mockReturnValue(undefined)
  vi.mocked(fillPoolAsync).mockResolvedValue(undefined)
  vi.mocked(persistFixedShelvesForSession).mockResolvedValue(undefined)
  vi.mocked(buildFallbackShelf).mockResolvedValue({
    id: 'sys_fallback_popular',
    title: 'Films populaires',
    type: 'SYSTEM',
    layoutHint: 'ROW',
    items: [{ mediaType: 'MOVIE', mediaId: 'fallback-01', title: 'Fallback Film', posterUrl: null }],
  })

  vi.mocked(serveBatch).mockResolvedValue({
    shelves: [makeBatchRow(0), makeBatchRow(1)],
    newNextPosition: 2,
    hasMore: true,
  })
})

// ---------------------------------------------------------------------------
// First request (no cursor)
// ---------------------------------------------------------------------------

describe('first request — no cursor', () => {
  it('returns sessionId, shelves, and nextCursor', async () => {
    const result = await buildHome(PROFILE_ID)
    expect(result.sessionId).toBe(SESSION_ID)
    expect(result.shelves.length).toBeGreaterThan(0)
    expect(result.nextCursor).not.toBeNull()
  })

  it('prepends fixed shelves before generated shelves', async () => {
    vi.mocked(buildFixedShelves).mockResolvedValue([CONTINUE_WATCHING, MY_LIST])
    const result = await buildHome(PROFILE_ID)
    expect(result.shelves[0].id).toBe('sys_continue_watching')
    expect(result.shelves[1].id).toBe('sys_my_list')
  })

  it('triggers async fillPool when pool runs low after serving', async () => {
    vi.mocked(countUnserved)
      .mockResolvedValueOnce(12) // call 1: initial (pool has content, skip sync fill)
      .mockResolvedValueOnce(12) // call 2: afterFillUnserved (go to serveBatch)
      .mockResolvedValueOnce(3)  // call 3: remaining (below HOME_POOL_MIN → fillPool)
    await buildHome(PROFILE_ID)
    expect(fillPool).toHaveBeenCalledWith(SESSION_ID, PROFILE_ID, 25)
  })

  it('calls fillPoolAsync synchronously when pool is empty on first load', async () => {
    vi.mocked(countUnserved)
      .mockResolvedValueOnce(0)  // initial: empty
      .mockResolvedValueOnce(6)  // after sync fill
      .mockResolvedValueOnce(6)  // replenishment check
    await buildHome(PROFILE_ID)
    expect(fillPoolAsync).toHaveBeenCalledWith(SESSION_ID, PROFILE_ID, 25)
  })

  it('returns fallback shelf and coldStart=true when pool is empty and fill fails', async () => {
    vi.mocked(countUnserved).mockResolvedValue(0)
    vi.mocked(fillPoolAsync).mockRejectedValue(new Error('LLM unavailable'))
    const result = await buildHome(PROFILE_ID)
    expect(result.coldStart).toBe(true)
    expect(result.shelves.some((s) => s.id === 'sys_fallback_popular')).toBe(true)
  })

  it('sets nextCursor to null when hasMore is false', async () => {
    vi.mocked(serveBatch).mockResolvedValue({
      shelves: [makeBatchRow(0)],
      newNextPosition: 1,
      hasMore: false,
    })
    vi.mocked(countUnserved).mockResolvedValue(0)
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
    // First db.select() call = session lookup → session row; subsequent calls → [] (for enrichment)
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
    // Reset to clear the queued once-mock from beforeEach, then set mismatch session.
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
    vi.mocked(countUnserved).mockResolvedValue(15) // doesn't matter
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
    // Pool has content so serveBatch is called (not the fallback branch).
    vi.mocked(countUnserved).mockResolvedValue(24)
    vi.mocked(getOrCreateSession).mockResolvedValue({ id: SESSION_ID, profileId: PROFILE_ID, cursorReference: null })
    const result = await buildHome(PROFILE_ID)
    const shelf = result.shelves.find((s) => s.id === 'i1')
    expect(shelf?.items).toHaveLength(24)
  })
})
