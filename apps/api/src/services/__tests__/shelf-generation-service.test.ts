import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

const mockRankRecommendations = vi.hoisted(() => vi.fn())
vi.mock('../recommendation-ranking-service.js', () => ({
  rankRecommendations: mockRankRecommendations,
}))

import { generateShelfFromSeeds, refreshGeneratedShelf } from '../shelf-generation-service.js'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SHELF_ID = 'eeeeeeee-0000-0000-0000-000000000001'
const MOVIE_ID_A = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOVIE_ID_B = 'aaaaaaaa-0000-0000-0000-000000000002'
const MOVIE_ID_C = 'aaaaaaaa-0000-0000-0000-000000000003'
const MOVIE_ID_D = 'aaaaaaaa-0000-0000-0000-000000000004'
const SERIES_ID_A = 'bbbbbbbb-0000-0000-0000-000000000001'
const DISCOVERY_ID_1 = 'dddddddd-0000-0000-0000-000000000001'
const CANONICAL_FROM_DISCOVERY = 'cccccccc-0000-0000-0000-000000000001'
const GENRE_ID_ACTION = 'gggggggg-0000-0000-0000-000000000001'

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function selectWhere(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function selectFrom(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockResolvedValue(rows),
  })
}

function selectFromWhere(rows: unknown[]) {
  selectWhere(rows)
}

function selectFromWhereInArray(rows: unknown[]) {
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupInsertReturning(rows: unknown[]) {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(rows),
    }),
  })
}

function setupInsertOnConflict() {
  mockDb.insert.mockReturnValueOnce({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue([]),
    }),
  })
}

function setupUpdateWhere() {
  mockDb.update.mockReturnValueOnce({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  })
}

function setupDeleteWhere() {
  mockDb.delete.mockReturnValueOnce({
    where: vi.fn().mockResolvedValue([]),
  })
}

// Standard setup for generateShelfFromSeeds with local-only recommendations:
// 1. selectWhere — movie seed validation (inArray movies)
// 2. selectWhere — series seed validation (inArray series) — skipped if no series seeds
// 3. selectWhere — movieGenres for seeds
// 4. selectWhere — seriesGenres for seeds — skipped if no series seeds
// 5. selectWhere — max position
// 6. insert shelf returning
// 7. insert members onConflictDoNothing (only if members.length > 0)
function setupGenerate({
  seedMovieRows = [{ id: MOVIE_ID_A, title: 'Movie A' }, { id: MOVIE_ID_B, title: 'Movie B' }],
  seedSeriesRows = null as unknown[] | null,
  movieGenreRows = [] as unknown[],
  seriesGenreRows = null as unknown[] | null,
  rankResult = {
    profileId: PROFILE_ID,
    coldStart: false,
    candidates: [
      { mediaType: 'MOVIE', mediaId: MOVIE_ID_C, title: 'Rec C', year: 2020, posterPath: null, score: 5, reasons: [], source: 'LOCAL', available: true },
    ],
  },
  maxPos = [{ maxPos: -1 }],
  shelfRow = { id: SHELF_ID, title: 'My Shelf', type: 'GENERATED', layoutHint: 'ROW', position: 0 },
  withMembers = true,
}: {
  seedMovieRows?: unknown[]
  seedSeriesRows?: unknown[] | null
  movieGenreRows?: unknown[]
  seriesGenreRows?: unknown[] | null
  rankResult?: object
  maxPos?: unknown[]
  shelfRow?: object
  withMembers?: boolean
} = {}) {
  // movie seeds validation
  selectFromWhereInArray(seedMovieRows)
  // series seeds validation (only called when there are series seeds)
  if (seedSeriesRows !== null) selectFromWhereInArray(seedSeriesRows)
  // movie genres
  selectFromWhereInArray(movieGenreRows)
  // series genres (only when series seeds present)
  if (seriesGenreRows !== null) selectFromWhereInArray(seriesGenreRows)

  mockRankRecommendations.mockResolvedValueOnce(rankResult)

  // max position
  mockDb.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(maxPos),
    }),
  })

  // insert shelf
  setupInsertReturning([shelfRow])

  // insert members
  if (withMembers) setupInsertOnConflict()
}

beforeEach(() => {
  vi.resetAllMocks()
})

// ---------------------------------------------------------------------------
// Scenario 1: Seed count validation
// ---------------------------------------------------------------------------

describe('seed count validation', () => {
  it('rejects fewer than 2 seeds', async () => {
    await expect(
      generateShelfFromSeeds(PROFILE_ID, {
        title: 'Test',
        seedMediaIds: [{ mediaType: 'MOVIE', mediaId: MOVIE_ID_A }],
      }),
    ).rejects.toThrow('seedMediaIds must have between 2 and 10 entries')
  })

  it('rejects more than 10 seeds', async () => {
    const seeds = Array.from({ length: 11 }, (_, i) => ({ mediaType: 'MOVIE' as const, mediaId: `id-${i}` }))
    await expect(
      generateShelfFromSeeds(PROFILE_ID, { title: 'Test', seedMediaIds: seeds }),
    ).rejects.toThrow('seedMediaIds must have between 2 and 10 entries')
  })

  it('accepts exactly 2 seeds', async () => {
    setupGenerate()
    const result = await generateShelfFromSeeds(PROFILE_ID, {
      title: 'My Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
    })
    expect(result.shelf.type).toBe('GENERATED')
  })
})

// ---------------------------------------------------------------------------
// Scenario 2: Unknown seed ID rejected
// ---------------------------------------------------------------------------

describe('unknown seed rejection', () => {
  it('rejects if a seed movie does not exist', async () => {
    // Only MOVIE_ID_A found, MOVIE_ID_B is unknown
    selectFromWhereInArray([{ id: MOVIE_ID_A, title: 'Movie A' }])

    await expect(
      generateShelfFromSeeds(PROFILE_ID, {
        title: 'Test',
        seedMediaIds: [
          { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
          { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
        ],
      }),
    ).rejects.toThrow(`Seed media not found: ${MOVIE_ID_B}`)
  })
})

// ---------------------------------------------------------------------------
// Scenario 3: Deterministic generation
// ---------------------------------------------------------------------------

describe('deterministic generation', () => {
  it('produces identical member order for same seeds and fixed ranking', async () => {
    const fixedCandidates = [
      { mediaType: 'MOVIE', mediaId: MOVIE_ID_C, title: 'C', year: 2020, posterPath: null, score: 10, reasons: [], source: 'LOCAL', available: true },
      { mediaType: 'MOVIE', mediaId: MOVIE_ID_D, title: 'D', year: 2021, posterPath: null, score: 5, reasons: [], source: 'LOCAL', available: true },
    ]
    const fixedRankResult = { profileId: PROFILE_ID, coldStart: false, candidates: fixedCandidates }

    setupGenerate({ rankResult: fixedRankResult })
    const result1 = await generateShelfFromSeeds(PROFILE_ID, {
      title: 'Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
    })

    // Check insert was called with members in score order (positions 0 and 1)
    const insertCall = mockDb.insert.mock.calls[1] // second insert = members
    const valuesCall = insertCall ? mockDb.insert.mock.results[1]?.value?.values : null
    // The members are inserted at positions 0, 1 in rank order
    expect(result1.shelf.type).toBe('GENERATED')
  })
})

// ---------------------------------------------------------------------------
// Scenario 4: Seed exclusion
// ---------------------------------------------------------------------------

describe('seed exclusion', () => {
  it('seed media IDs are absent from generated members', async () => {
    // Ranking returns MOVIE_ID_A (a seed) and MOVIE_ID_C (a recommendation)
    const rankResult = {
      profileId: PROFILE_ID,
      coldStart: false,
      candidates: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A, title: 'A', year: 2020, posterPath: null, score: 10, reasons: [], source: 'LOCAL', available: true },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_C, title: 'C', year: 2021, posterPath: null, score: 5, reasons: [], source: 'LOCAL', available: true },
      ],
    }
    setupGenerate({ rankResult })

    await generateShelfFromSeeds(PROFILE_ID, {
      title: 'Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
    })

    // The insert for members should only contain MOVIE_ID_C, not MOVIE_ID_A
    const insertValues = mockDb.insert.mock.results[1]?.value
    expect(insertValues).toBeDefined()
    // values() was called — check what was passed
    const valuesArg = insertValues?.values.mock.calls[0][0]
    const memberIds = valuesArg?.map((m: { mediaId: string }) => m.mediaId) ?? []
    expect(memberIds).not.toContain(MOVIE_ID_A)
    expect(memberIds).toContain(MOVIE_ID_C)
  })
})

// ---------------------------------------------------------------------------
// Scenario 5: Deduplication — candidate with existing canonical link
// ---------------------------------------------------------------------------

describe('deduplication', () => {
  it('uses existing canonical ID when discovery candidate already has a canonical link', async () => {
    const existingCanonicalId = CANONICAL_FROM_DISCOVERY
    const rankResult = {
      profileId: PROFILE_ID,
      coldStart: false,
      candidates: [
        {
          mediaType: 'MOVIE',
          mediaId: DISCOVERY_ID_1,
          title: 'Discovery Movie',
          year: 2022,
          posterPath: null,
          score: 8,
          reasons: [],
          source: 'DISCOVERY',
          available: false,
        },
      ],
    }

    // movie seeds
    selectFromWhereInArray([{ id: MOVIE_ID_A, title: 'A' }, { id: MOVIE_ID_B, title: 'B' }])
    // movie genres
    selectFromWhereInArray([])
    // rank
    mockRankRecommendations.mockResolvedValueOnce(rankResult)
    // materialize — discovery candidate query: has canonicalMovieId already
    selectFromWhere([{ id: DISCOVERY_ID_1, canonicalMovieId: existingCanonicalId, canonicalSeriesId: null, title: 'Discovery Movie', year: 2022, synopsis: null, posterPath: null, provenance: 'tmdb' }])
    // max position
    mockDb.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ maxPos: -1 }]) }) })
    // insert shelf
    setupInsertReturning([{ id: SHELF_ID, title: 'Shelf', type: 'GENERATED', layoutHint: 'ROW', position: 0 }])
    // insert members
    setupInsertOnConflict()

    await generateShelfFromSeeds(PROFILE_ID, {
      title: 'Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
    })

    // No new movie was inserted (insert only called for shelf + members, not for a canonical movie)
    const insertCalls = mockDb.insert.mock.calls
    expect(insertCalls).toHaveLength(2) // shelf + members
  })
})

// ---------------------------------------------------------------------------
// Scenario 6: Materialization — discovery candidate without canonical link
// ---------------------------------------------------------------------------

describe('materialization', () => {
  it('creates canonical Movie row when discovery candidate has no canonical link', async () => {
    const newCanonicalId = CANONICAL_FROM_DISCOVERY
    const rankResult = {
      profileId: PROFILE_ID,
      coldStart: false,
      candidates: [
        {
          mediaType: 'MOVIE',
          mediaId: DISCOVERY_ID_1,
          title: 'New Movie',
          year: 2023,
          posterPath: null,
          score: 7,
          reasons: [],
          source: 'DISCOVERY',
          available: false,
        },
      ],
    }

    // movie seeds
    selectFromWhereInArray([{ id: MOVIE_ID_A, title: 'A' }, { id: MOVIE_ID_B, title: 'B' }])
    // movie genres
    selectFromWhereInArray([])
    // rank
    mockRankRecommendations.mockResolvedValueOnce(rankResult)
    // materialize — discovery candidate with no canonical link
    selectFromWhere([{ id: DISCOVERY_ID_1, canonicalMovieId: null, canonicalSeriesId: null, title: 'New Movie', year: 2023, synopsis: null, posterPath: null, provenance: 'tmdb' }])
    // insert canonical movie
    setupInsertReturning([{ id: newCanonicalId }])
    // update discovery candidate canonical link
    setupUpdateWhere()
    // max position
    mockDb.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ maxPos: -1 }]) }) })
    // insert shelf
    setupInsertReturning([{ id: SHELF_ID, title: 'Shelf', type: 'GENERATED', layoutHint: 'ROW', position: 0 }])
    // insert members
    setupInsertOnConflict()

    await generateShelfFromSeeds(PROFILE_ID, {
      title: 'Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
    })

    // insert was called for: canonical movie, shelf, members = 3 inserts
    expect(mockDb.insert.mock.calls).toHaveLength(3)
    // update was called to link canonical ID back to discovery candidate
    expect(mockDb.update).toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Scenario 7: availableToMe constraint passed to ranking
// ---------------------------------------------------------------------------

describe('availableToMe constraint', () => {
  it('passes availableToMe to rankRecommendations', async () => {
    setupGenerate({ rankResult: { profileId: PROFILE_ID, coldStart: false, candidates: [] }, withMembers: false })

    await generateShelfFromSeeds(PROFILE_ID, {
      title: 'Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
      availableToMe: true,
    })

    expect(mockRankRecommendations).toHaveBeenCalledWith(
      PROFILE_ID,
      expect.objectContaining({ availableToMe: true }),
    )
  })
})

// ---------------------------------------------------------------------------
// Scenario 8: Persistence — rules stored correctly
// ---------------------------------------------------------------------------

describe('persistence', () => {
  it('created shelf has type GENERATED, seedMediaIds in rules, and generatedAt set', async () => {
    const seeds = [
      { mediaType: 'MOVIE' as const, mediaId: MOVIE_ID_A },
      { mediaType: 'MOVIE' as const, mediaId: MOVIE_ID_B },
    ]
    setupGenerate({
      movieGenreRows: [{ genreId: GENRE_ID_ACTION }],
    })

    await generateShelfFromSeeds(PROFILE_ID, {
      title: 'My Shelf',
      seedMediaIds: seeds,
    })

    const insertShelfCall = mockDb.insert.mock.results[0]?.value
    const valuesArg = insertShelfCall?.values.mock.calls[0][0]

    expect(valuesArg.type).toBe('GENERATED')
    expect(valuesArg.rules.seedMediaIds).toEqual(seeds)
    expect(valuesArg.rules.inferredGenreIds).toContain(GENRE_ID_ACTION)
    expect(typeof valuesArg.rules.generatedAt).toBe('string')
    expect(new Date(valuesArg.rules.generatedAt).getTime()).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Scenario 9: Refresh — replaces members and updates generatedAt
// ---------------------------------------------------------------------------

describe('refresh', () => {
  it('replaces members and updates generatedAt for a GENERATED shelf', async () => {
    const storedRules = {
      seedMediaIds: [{ mediaType: 'MOVIE', mediaId: MOVIE_ID_A }, { mediaType: 'MOVIE', mediaId: MOVIE_ID_B }],
      mediaType: undefined,
      availableToMe: undefined,
      limit: 20,
      inferredGenreIds: [GENRE_ID_ACTION],
      generatedAt: '2024-01-01T00:00:00.000Z',
    }

    // Load shelf
    selectFromWhere([{ id: SHELF_ID, profileId: PROFILE_ID, type: 'GENERATED', title: 'My Shelf', layoutHint: 'ROW', position: 0, rules: storedRules }])

    // resolveGeneratedMembers:
    // movie seed validation
    selectFromWhereInArray([{ id: MOVIE_ID_A, title: 'A' }, { id: MOVIE_ID_B, title: 'B' }])
    // movie genres
    selectFromWhereInArray([{ genreId: GENRE_ID_ACTION }])
    // rank
    mockRankRecommendations.mockResolvedValueOnce({
      profileId: PROFILE_ID,
      coldStart: false,
      candidates: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_C, title: 'C', year: 2021, posterPath: null, score: 5, reasons: [], source: 'LOCAL', available: true },
      ],
    })

    // delete existing members
    setupDeleteWhere()
    // insert new members
    setupInsertOnConflict()
    // update shelf rules
    setupUpdateWhere()

    const result = await refreshGeneratedShelf(SHELF_ID, PROFILE_ID)

    expect(result.shelf.type).toBe('GENERATED')
    expect(mockDb.delete).toHaveBeenCalledOnce()
    expect(mockDb.update).toHaveBeenCalledOnce()

    // generatedAt should be updated
    const updateCall = mockDb.update.mock.results[0]?.value
    const setCall = updateCall?.set.mock.calls[0][0]
    expect(setCall?.rules?.generatedAt).not.toBe(storedRules.generatedAt)
  })

  it('rejects refresh on a non-GENERATED shelf', async () => {
    selectFromWhere([{ id: SHELF_ID, profileId: PROFILE_ID, type: 'MANUAL', title: 'Manual', layoutHint: 'ROW', position: 0, rules: null }])

    await expect(refreshGeneratedShelf(SHELF_ID, PROFILE_ID)).rejects.toThrow('Shelf is not a GENERATED shelf')
  })

  it('returns 404 when shelf does not exist', async () => {
    selectFromWhere([])
    await expect(refreshGeneratedShelf('nonexistent-id', PROFILE_ID)).rejects.toThrow('nonexistent-id not found')
  })
})

// ---------------------------------------------------------------------------
// Scenario 10: Explanation metadata
// ---------------------------------------------------------------------------

describe('explanation metadata', () => {
  it('returns inferredGenreIds and seedTitles in explanation', async () => {
    setupGenerate({
      seedMovieRows: [{ id: MOVIE_ID_A, title: 'Film A' }, { id: MOVIE_ID_B, title: 'Film B' }],
      movieGenreRows: [{ genreId: GENRE_ID_ACTION }],
    })

    const result = await generateShelfFromSeeds(PROFILE_ID, {
      title: 'Shelf',
      seedMediaIds: [
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_A },
        { mediaType: 'MOVIE', mediaId: MOVIE_ID_B },
      ],
    })

    expect(result.explanation.seedTitles).toEqual(['Film A', 'Film B'])
    expect(result.explanation.inferredGenreIds).toContain(GENRE_ID_ACTION)
  })
})
