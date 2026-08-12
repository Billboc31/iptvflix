import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../shelf-service.js', () => ({
  getShelf: vi.fn(),
}))

vi.mock('../recommendation-ranking-service.js', () => ({
  rankRecommendations: vi.fn(),
}))

import { buildHome } from '../home-service.js'
import { getShelf } from '../shelf-service.js'
import { rankRecommendations } from '../recommendation-ranking-service.js'
import type { ShelfResponse, RecommendationsResponse } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'

const MOVIE_IN_PROGRESS = 'movie-in-progress-000000000001'
const MOVIE_AVAILABLE_A = 'movie-available-0000000000001'
const MOVIE_AVAILABLE_B = 'movie-available-0000000000002'
const MOVIE_UPCOMING_A = 'movie-upcoming-000000000000001'
const MOVIE_UPCOMING_B = 'movie-upcoming-000000000000002'
const MOVIE_UPCOMING_C = 'movie-upcoming-000000000000003'

// ---------------------------------------------------------------------------
// Shelf fixtures
// ---------------------------------------------------------------------------

const EMPTY_SHELF = (id: string): ShelfResponse => ({
  id,
  title: id,
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [],
})

const CONTINUE_WATCHING_WITH_ITEM: ShelfResponse = {
  id: 'sys_continue_watching',
  title: 'Continuer à regarder',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [
    { mediaType: 'MOVIE', mediaId: MOVIE_IN_PROGRESS, title: 'In Progress Movie', posterUrl: null, progressSeconds: 600, durationSeconds: 3600 },
  ],
}

const MY_LIST_WITH_ITEM: ShelfResponse = {
  id: 'sys_my_list',
  title: 'Ma liste',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [
    { mediaType: 'MOVIE', mediaId: MOVIE_AVAILABLE_A, title: 'Listed Movie', posterUrl: null },
  ],
}

// ---------------------------------------------------------------------------
// Recommendation fixtures
// ---------------------------------------------------------------------------

function makeCandidate(mediaId: string, available: boolean, score = 1) {
  return {
    mediaType: 'MOVIE' as const,
    mediaId,
    title: mediaId,
    year: 2024,
    posterPath: null,
    score,
    reasons: ['popular pick'],
    source: 'LOCAL' as const,
    available,
  }
}

const WARM_RECS_RESPONSE = (candidates: RecommendationsResponse['candidates']): RecommendationsResponse => ({
  profileId: PROFILE_ID,
  coldStart: false,
  candidates,
})

const COLD_RECS_RESPONSE = (candidates: RecommendationsResponse['candidates']): RecommendationsResponse => ({
  profileId: PROFILE_ID,
  coldStart: true,
  candidates,
})

// ---------------------------------------------------------------------------
// Test setup helper
// ---------------------------------------------------------------------------

function setupMocks({
  continueWatching = EMPTY_SHELF('sys_continue_watching'),
  myList = EMPTY_SHELF('sys_my_list'),
  recs,
}: {
  continueWatching?: ShelfResponse
  myList?: ShelfResponse
  recs: RecommendationsResponse
}) {
  vi.mocked(getShelf).mockImplementation(async (id) => {
    if (id === 'sys_continue_watching') return continueWatching
    if (id === 'sys_my_list') return myList
    throw new Error(`unexpected shelf: ${id}`)
  })
  vi.mocked(rankRecommendations).mockResolvedValue(recs)
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Scenario 1: Warm profile
// ---------------------------------------------------------------------------

describe('warm profile', () => {
  it('returns sys_rec_for_you with available candidates and coldStart false', async () => {
    setupMocks({
      continueWatching: CONTINUE_WATCHING_WITH_ITEM,
      recs: WARM_RECS_RESPONSE([
        makeCandidate(MOVIE_AVAILABLE_A, true, 5),
        makeCandidate(MOVIE_AVAILABLE_B, true, 3),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    expect(result.coldStart).toBe(false)
    const recShelf = result.shelves.find((s) => s.id === 'sys_rec_for_you')
    expect(recShelf).toBeDefined()
    expect(recShelf!.items).toHaveLength(2)
    expect(recShelf!.items[0].mediaId).toBe(MOVIE_AVAILABLE_A)
  })

  it('positions Continue Watching first when non-empty', async () => {
    setupMocks({
      continueWatching: CONTINUE_WATCHING_WITH_ITEM,
      recs: WARM_RECS_RESPONSE([makeCandidate(MOVIE_AVAILABLE_A, true)]),
    })

    const result = await buildHome(PROFILE_ID)

    expect(result.shelves[0].id).toBe('sys_continue_watching')
  })

  it('includes My List after sys_rec_for_you when non-empty', async () => {
    setupMocks({
      myList: MY_LIST_WITH_ITEM,
      recs: WARM_RECS_RESPONSE([makeCandidate(MOVIE_AVAILABLE_A, true)]),
    })

    const result = await buildHome(PROFILE_ID)

    const ids = result.shelves.map((s) => s.id)
    const recIdx = ids.indexOf('sys_rec_for_you')
    const myListIdx = ids.indexOf('sys_my_list')
    expect(myListIdx).toBeGreaterThan(recIdx)
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Cold start
// ---------------------------------------------------------------------------

describe('cold start', () => {
  it('returns coldStart true and still populates sys_rec_for_you from popularity', async () => {
    setupMocks({
      recs: COLD_RECS_RESPONSE([
        makeCandidate(MOVIE_AVAILABLE_A, true, 10),
        makeCandidate(MOVIE_AVAILABLE_B, true, 8),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    expect(result.coldStart).toBe(true)
    const recShelf = result.shelves.find((s) => s.id === 'sys_rec_for_you')
    expect(recShelf).toBeDefined()
    expect(recShelf!.items.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Availability filtering
// ---------------------------------------------------------------------------

describe('availability filtering', () => {
  it('candidates with available=false never appear in sys_rec_for_you', async () => {
    setupMocks({
      recs: WARM_RECS_RESPONSE([
        makeCandidate(MOVIE_AVAILABLE_A, true),
        makeCandidate(MOVIE_UPCOMING_A, false),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    const recShelf = result.shelves.find((s) => s.id === 'sys_rec_for_you')!
    const ids = recShelf.items.map((i) => i.mediaId)
    expect(ids).toContain(MOVIE_AVAILABLE_A)
    expect(ids).not.toContain(MOVIE_UPCOMING_A)
  })

  it('candidates with available=true never appear in sys_rec_upcoming', async () => {
    setupMocks({
      recs: WARM_RECS_RESPONSE([
        makeCandidate(MOVIE_AVAILABLE_A, true),
        makeCandidate(MOVIE_UPCOMING_A, false),
        makeCandidate(MOVIE_UPCOMING_B, false),
        makeCandidate(MOVIE_UPCOMING_C, false),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    const upcomingShelf = result.shelves.find((s) => s.id === 'sys_rec_upcoming')!
    expect(upcomingShelf).toBeDefined()
    const ids = upcomingShelf.items.map((i) => i.mediaId)
    expect(ids).not.toContain(MOVIE_AVAILABLE_A)
    expect(ids).toContain(MOVIE_UPCOMING_A)
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Duplicate suppression (Continue Watching exclusion)
// ---------------------------------------------------------------------------

describe('duplicate suppression', () => {
  it('in-progress media IDs are absent from sys_rec_for_you', async () => {
    setupMocks({
      continueWatching: CONTINUE_WATCHING_WITH_ITEM,
      recs: WARM_RECS_RESPONSE([
        makeCandidate(MOVIE_IN_PROGRESS, true, 10),
        makeCandidate(MOVIE_AVAILABLE_A, true, 5),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    const recShelf = result.shelves.find((s) => s.id === 'sys_rec_for_you')!
    const ids = recShelf.items.map((i) => i.mediaId)
    expect(ids).not.toContain(MOVIE_IN_PROGRESS)
    expect(ids).toContain(MOVIE_AVAILABLE_A)
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: Discovery threshold
// ---------------------------------------------------------------------------

describe('discovery threshold', () => {
  it('omits sys_rec_upcoming when fewer than 3 unavailable candidates', async () => {
    setupMocks({
      recs: WARM_RECS_RESPONSE([
        makeCandidate(MOVIE_AVAILABLE_A, true),
        makeCandidate(MOVIE_UPCOMING_A, false),
        makeCandidate(MOVIE_UPCOMING_B, false),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    const upcomingShelf = result.shelves.find((s) => s.id === 'sys_rec_upcoming')
    expect(upcomingShelf).toBeUndefined()
  })

  it('includes sys_rec_upcoming when exactly 3 unavailable candidates exist', async () => {
    setupMocks({
      recs: WARM_RECS_RESPONSE([
        makeCandidate(MOVIE_UPCOMING_A, false),
        makeCandidate(MOVIE_UPCOMING_B, false),
        makeCandidate(MOVIE_UPCOMING_C, false),
      ]),
    })

    const result = await buildHome(PROFILE_ID)

    const upcomingShelf = result.shelves.find((s) => s.id === 'sys_rec_upcoming')
    expect(upcomingShelf).toBeDefined()
    expect(upcomingShelf!.items).toHaveLength(3)
  })
})
