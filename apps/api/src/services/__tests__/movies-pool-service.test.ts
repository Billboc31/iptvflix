import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  HOME_FRESH_DAYS: 90,
  MOVIES_BATCH_SIZE: 6,
  MOVIES_ITEMS_MAX: 30,
  MOVIES_ITEMS_PER_SHELF: 24,
  MOVIES_POOL_TARGET: 25,
  MOVIES_SESSION_TTL_HOURS: 24,
  MOVIES_EXPLORATION_RATIO: 0.25,
  NOUVEAUTES_MIN_ITEMS: 5,
  NOUVEAUTES_ITEMS_PER_SHELF: 20,
}))

vi.mock('../nouveautes-service.js', () => ({
  buildNouveautesItems: vi.fn().mockResolvedValue([]),
}))

const mockPersistShelfInstance = vi.hoisted(() => vi.fn())
const mockGetFatigueStates = vi.hoisted(() => vi.fn())

vi.mock('../shelf-instance-service.js', () => ({
  ShelfInstanceService: vi.fn().mockImplementation(function () {
    return { persistShelfInstance: mockPersistShelfInstance }
  }),
}))

vi.mock('../shelf-fatigue-service.js', () => ({
  ShelfFatigueService: vi.fn().mockImplementation(function () {
    return { getFatigueStates: mockGetFatigueStates }
  }),
}))

const mockDb = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() }))
vi.mock('../../db/client.js', () => ({ db: mockDb }))

vi.mock('../recommendation-ranking-service.js', () => ({ rankRecommendations: vi.fn() }))
vi.mock('../../client/recommendation-engine-client.js', () => ({
  RecommendationEngineClient: { queryForShelf: vi.fn() },
}))

vi.mock('../../db/schema/index.js', () => ({
  shelfInstances: {},
  shelfInstanceItems: {},
  shelfConcepts: {},
  movies: {},
  series: {},
  mediaVideos: {},
  movieAvailabilities: {},
  moviesSessions: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  asc: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  or: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p: string | null) => (p ? `https://img/${p}` : null)),
}))

import { buildMoviesDeclaredRails, fillMoviesPoolAsync } from '../movies-pool-service.js'
import { RecommendationEngineClient } from '../../client/recommendation-engine-client.js'
import { rankRecommendations } from '../recommendation-ranking-service.js'
import { ShelfInstanceService } from '../shelf-instance-service.js'
import { ShelfFatigueService } from '../shelf-fatigue-service.js'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'
let instanceCounter = 0

function makeCandidates(mediaIds: string[], mediaType: 'MOVIE' | 'SERIES' = 'MOVIE', semanticScore = 0.8) {
  return {
    candidates: mediaIds.map((id) => ({
      mediaId: id,
      mediaType,
      semanticScore,
      profileScore: 0.9,
      finalScore: 0.85,
      reasons: [],
      available: true,
    })),
    queryPlannerVersion: 'v1',
    embeddingModelVersion: 'v1',
    rankerVersion: 'v1',
    candidateCount: mediaIds.length,
  }
}

function makePersonalizedConcept(id = 'concept-p1', title = 'Films d\'action') {
  return {
    id,
    profileId: PROFILE_ID,
    title,
    rawIntent: title,
    semanticIntent: 'films action aventure',
    generationType: 'PERSONALIZED' as const,
    reasonCodes: [],
    sourceModel: 'gpt-4o-mini',
    promptVersion: 'v1',
    desiredMediaTypes: ['MOVIE'],
    semanticAnchor: null,
    freshnessPolicy: null,
    active: true,
    createdAt: new Date(),
    expiresAt: null,
    reachCount: 0,
    openCount: 0,
    playCount: 0,
    completionCount: 0,
    dismissCount: 0,
  }
}

function makeExplorationConcept(id = 'concept-e1', title = 'Cinéma d\'auteur') {
  return {
    ...makePersonalizedConcept(id, title),
    generationType: 'EXPLORATION' as const,
    semanticIntent: 'films art et essai indépendant',
  }
}

function makeChain(rows: unknown[] = []) {
  const prom = Promise.resolve(rows)
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
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
  vi.resetAllMocks()
  instanceCounter = 0

  ;(ShelfInstanceService as any).mockImplementation(function () { return { persistShelfInstance: mockPersistShelfInstance } })
  ;(ShelfFatigueService as any).mockImplementation(function () { return { getFatigueStates: mockGetFatigueStates } })

  mockPersistShelfInstance.mockImplementation(() => Promise.resolve(`instance-${++instanceCounter}`))
  mockGetFatigueStates.mockResolvedValue(new Map())

  // Engine returns null by default (no results)
  vi.mocked(RecommendationEngineClient.queryForShelf).mockResolvedValue(null)
  // rankRecommendations returns empty by default
  vi.mocked(rankRecommendations).mockResolvedValue({ profileId: PROFILE_ID, coldStart: false, candidates: [] })

  // DB: all empty by default
  mockDb.select.mockReturnValue(makeChain([]))

  const updateChain = { set: vi.fn(() => updateChain), where: vi.fn(() => Promise.resolve([])) }
  mockDb.update.mockReturnValue(updateChain)
})

// ---------------------------------------------------------------------------
// Helper: set up DB concept selects in declaration order
// ---------------------------------------------------------------------------

function setupConceptSelects(opts: {
  p1?: ReturnType<typeof makePersonalizedConcept>
  p2?: ReturnType<typeof makePersonalizedConcept>
  exp?: ReturnType<typeof makeExplorationConcept> | null
  p3?: ReturnType<typeof makePersonalizedConcept>
  rail2FreshIds?: string[]
}) {
  if (opts.rail2FreshIds && opts.rail2FreshIds.length > 0) {
    mockDb.select.mockReturnValueOnce(makeChain(opts.rail2FreshIds.map((id) => ({ id }))))
  }
  mockDb.select.mockReturnValueOnce(makeChain(opts.p1 ? [opts.p1] : []))
  mockDb.select.mockReturnValueOnce(makeChain(opts.p2 ? [opts.p2] : []))
  mockDb.select.mockReturnValueOnce(makeChain(opts.exp !== undefined ? (opts.exp ? [opts.exp] : []) : [makeExplorationConcept()]))
  mockDb.select.mockReturnValueOnce(makeChain(opts.p3 ? [opts.p3] : []))
  // Enrichment: movies + trailers (empty → titles will be '')
  mockDb.select.mockReturnValue(makeChain([]))
}

// ---------------------------------------------------------------------------
// Tests — movie-only constraint
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — movie-only constraint', () => {
  it('filters out SERIES items even if engine returns mixed results', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce({
        candidates: [
          { mediaId: 'movie-1', mediaType: 'MOVIE', semanticScore: 0.8, profileScore: 0.9, finalScore: 0.85, reasons: [], available: true },
          { mediaId: 'series-1', mediaType: 'SERIES', semanticScore: 0.7, profileScore: 0.8, finalScore: 0.75, reasons: [], available: true },
        ],
        queryPlannerVersion: 'v1',
        embeddingModelVersion: 'v1',
        rankerVersion: 'v1',
        candidateCount: 2,
      })
      // All subsequent calls return null → rankRecommendations returns empty
      .mockResolvedValue(null)

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1'),
      p2: makePersonalizedConcept('cp2'),
      p3: makePersonalizedConcept('cp3'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    for (const shelf of shelves) {
      for (const item of shelf.items) {
        expect(item.mediaType).toBe('MOVIE')
      }
    }
  })

  it('calls the engine for each declared rail with the correct profileId', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf).mockResolvedValue(null)
    setupConceptSelects({ p1: makePersonalizedConcept('cp1'), p2: makePersonalizedConcept('cp2'), p3: makePersonalizedConcept('cp3') })

    await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const calls = vi.mocked(RecommendationEngineClient.queryForShelf).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call[0].profileId).toBe(PROFILE_ID)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests — exploitation/exploration ratio in declared batch
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — exploitation/exploration ratio', () => {
  it('includes at least one EXPLORATION concept in the declared thematic batch', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)                       // rail 1: Pour toi empty
      .mockResolvedValueOnce(null)                       // rail 2: Nouveautés empty
      .mockResolvedValueOnce(makeCandidates(['m3']))     // thematic p1
      .mockResolvedValueOnce(makeCandidates(['m4']))     // thematic p2
      .mockResolvedValueOnce(makeCandidates(['m5']))     // exploration
      .mockResolvedValueOnce(makeCandidates(['m6']))     // thematic p3

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1', 'Aventures'),
      p2: makePersonalizedConcept('cp2', 'Drames'),
      exp: makeExplorationConcept('ce1', 'Cinéma mondial'),
      p3: makePersonalizedConcept('cp3', 'Comédies'),
    })

    await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const types = mockPersistShelfInstance.mock.calls.map((args) => args[0].generationType as string)
    const hasExploration = types.some((t) => t === 'EXPLORATION' || t === 'DISCOVERY')
    expect(hasExploration).toBe(true)
  })

  it('thematic exploitation slots outnumber exploration slots (75/25)', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCandidates(['m3']))
      .mockResolvedValueOnce(makeCandidates(['m4']))
      .mockResolvedValueOnce(makeCandidates(['m5']))
      .mockResolvedValueOnce(makeCandidates(['m6']))

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1', 'A'),
      p2: makePersonalizedConcept('cp2', 'B'),
      exp: makeExplorationConcept('ce1', 'C'),
      p3: makePersonalizedConcept('cp3', 'D'),
    })

    await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const thematicTypes = mockPersistShelfInstance.mock.calls
      .map((args) => args[0].generationType as string)
      .filter((t) => t !== 'SYSTEM_DECLARED')

    const explorationCount = thematicTypes.filter((t) => t === 'EXPLORATION' || t === 'DISCOVERY').length
    const totalThematic = thematicTypes.length

    if (totalThematic > 0) {
      const ratio = explorationCount / totalThematic
      expect(ratio).toBeGreaterThanOrEqual(0.2)
      expect(ratio).toBeLessThanOrEqual(0.35)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests — theme diversity
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — theme diversity', () => {
  it('does not produce two shelves with the same title in a single batch', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1']))   // rail 1
      .mockResolvedValueOnce(null)                      // rail 2
      .mockResolvedValueOnce(makeCandidates(['m3']))    // thematic p1
      .mockResolvedValueOnce(makeCandidates(['m4']))    // thematic p2
      .mockResolvedValueOnce(makeCandidates(['m5']))    // exploration
      .mockResolvedValueOnce(makeCandidates(['m6']))    // thematic p3

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1', 'Aventures'),
      p2: makePersonalizedConcept('cp2', 'Drames'),
      exp: makeExplorationConcept('ce1', 'Cinéma mondial'),
      p3: makePersonalizedConcept('cp3', 'Comédies'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const titles = shelves.map((s) => s.title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  it('uses separate concept IDs for each thematic slot', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCandidates(['m3']))
      .mockResolvedValueOnce(makeCandidates(['m4']))
      .mockResolvedValueOnce(makeCandidates(['m5']))
      .mockResolvedValueOnce(makeCandidates(['m6']))

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1', 'A'),
      p2: makePersonalizedConcept('cp2', 'B'),
      exp: makeExplorationConcept('ce1', 'C'),
      p3: makePersonalizedConcept('cp3', 'D'),
    })

    await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const conceptIds = mockPersistShelfInstance.mock.calls
      .filter((args) => args[0].shelfConceptId !== null)
      .map((args) => args[0].shelfConceptId)
    expect(new Set(conceptIds).size).toBe(conceptIds.length)
  })
})

// ---------------------------------------------------------------------------
// Tests — cross-shelf deduplication
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — cross-shelf deduplication', () => {
  it('a mediaId appearing in rail 1 does not appear in later rails', async () => {
    const sharedId = 'shared-movie'

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm2']))          // rail 1
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm3', 'm4']))    // rail 2 (freshness check needed)
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm5']))           // thematic p1
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm6']))           // thematic p2
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm7']))           // exploration
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm8']))           // thematic p3

    // rail 2 freshness: m3 and m4 are fresh (sharedId already excluded before freshness)
    setupConceptSelects({
      rail2FreshIds: ['m3', 'm4'],
      p1: makePersonalizedConcept('cp1', 'A'),
      p2: makePersonalizedConcept('cp2', 'B'),
      exp: makeExplorationConcept('ce1', 'C'),
      p3: makePersonalizedConcept('cp3', 'D'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const pourToi = shelves.find((s) => s.title === 'Pour toi')
    expect(pourToi?.items.some((i) => i.mediaId === sharedId)).toBe(true)

    for (const shelf of shelves.filter((s) => s.title !== 'Pour toi')) {
      expect(shelf.items.some((i) => i.mediaId === sharedId)).toBe(false)
    }
  })

  it('no mediaId appears in more than one shelf', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1', 'm2']))    // rail 1
      .mockResolvedValueOnce(makeCandidates(['m3', 'm4']))    // rail 2
      .mockResolvedValueOnce(makeCandidates(['m5', 'm6']))    // thematic p1
      .mockResolvedValueOnce(makeCandidates(['m7', 'm8']))    // thematic p2
      .mockResolvedValueOnce(makeCandidates(['m9', 'm10']))   // exploration
      .mockResolvedValueOnce(makeCandidates(['m11', 'm12']))  // thematic p3

    setupConceptSelects({
      rail2FreshIds: ['m3', 'm4'],
      p1: makePersonalizedConcept('cp1', 'A'),
      p2: makePersonalizedConcept('cp2', 'B'),
      exp: makeExplorationConcept('ce1', 'C'),
      p3: makePersonalizedConcept('cp3', 'D'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const seen = new Set<string>()
    for (const shelf of shelves) {
      for (const item of shelf.items) {
        expect(seen.has(item.mediaId)).toBe(false)
        seen.add(item.mediaId)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Tests — empty concept
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — empty concept', () => {
  it('concept with zero MOVIE results produces no shelf in output', async () => {
    // Rail 1 succeeds, all thematic slots are empty
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1']))   // rail 1
      .mockResolvedValue(null)                          // all others: engine null + rankRec empty

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1'),
      p2: makePersonalizedConcept('cp2'),
      p3: makePersonalizedConcept('cp3'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    expect(shelves).toHaveLength(1)
    expect(shelves[0].title).toBe('Pour toi')
  })
})

// ---------------------------------------------------------------------------
// Tests — error isolation
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — error isolation', () => {
  it('engine failure on rail 1 does not prevent thematic shelves from rendering', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockRejectedValueOnce(new Error('engine crash'))   // rail 1 throws
      .mockResolvedValueOnce(null)                         // rail 2 empty
      .mockResolvedValueOnce(makeCandidates(['m5']))       // thematic p1 succeeds
      .mockResolvedValue(null)

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1', 'Action'),
      p2: makePersonalizedConcept('cp2', 'Drame'),
      p3: makePersonalizedConcept('cp3', 'Comédie'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    expect(shelves.find((s) => s.title === 'Pour toi')).toBeUndefined()
    expect(shelves.length).toBeGreaterThanOrEqual(1)
  })

  it('persistence failure on one rail does not abort subsequent rails', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1']))   // rail 1
      .mockResolvedValueOnce(null)                      // rail 2
      .mockResolvedValueOnce(makeCandidates(['m5']))    // thematic p1
      .mockResolvedValue(null)

    mockPersistShelfInstance
      .mockRejectedValueOnce(new Error('db error'))  // rail 1 persist fails
      .mockResolvedValueOnce('instance-2')            // thematic p1 persists

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1', 'Action'),
      p2: makePersonalizedConcept('cp2'),
      p3: makePersonalizedConcept('cp3'),
    })

    const { shelves } = await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    expect(shelves.find((s) => s.title === 'Pour toi')).toBeUndefined()
    expect(shelves.length).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Tests — exploration semantic score gate
// ---------------------------------------------------------------------------

describe('buildMoviesDeclaredRails — exploration non-random requirement', () => {
  it('exploration shelf items have non-zero semantic scores', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)   // rail 1
      .mockResolvedValueOnce(null)   // rail 2
      .mockResolvedValueOnce(null)   // thematic p1
      .mockResolvedValueOnce(null)   // thematic p2
      .mockResolvedValueOnce({       // exploration slot — non-zero semantic scores
        candidates: [
          { mediaId: 'exp-1', mediaType: 'MOVIE', semanticScore: 0.6, profileScore: 0.5, finalScore: 0.55, reasons: [], available: true },
          { mediaId: 'exp-2', mediaType: 'MOVIE', semanticScore: 0.55, profileScore: 0.45, finalScore: 0.5, reasons: [], available: true },
        ],
        queryPlannerVersion: 'v1',
        embeddingModelVersion: 'v1',
        rankerVersion: 'v1',
        candidateCount: 2,
      })
      .mockResolvedValueOnce(null)   // thematic p3

    setupConceptSelects({
      p1: makePersonalizedConcept('cp1'),
      p2: makePersonalizedConcept('cp2'),
      exp: makeExplorationConcept('ce1', 'Cinéma mondial'),
      p3: makePersonalizedConcept('cp3'),
    })

    await buildMoviesDeclaredRails(PROFILE_ID, SESSION_ID)

    const explorationCall = mockPersistShelfInstance.mock.calls.find(
      (args) => args[0].generationType === 'EXPLORATION' || args[0].generationType === 'DISCOVERY',
    )
    expect(explorationCall).toBeDefined()
    const items = explorationCall![0].items as Array<{ semanticScore: number }>
    expect(items.every((item) => item.semanticScore > 0)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests — fillMoviesPoolAsync exploitation/exploration ratio
// ---------------------------------------------------------------------------

describe('fillMoviesPoolAsync — exploitation/exploration ratio', () => {
  it('generates approximately 25% exploration shelves across many slots', async () => {
    const personalizedConcepts = Array.from({ length: 20 }, (_, i) =>
      makePersonalizedConcept(`cp${i}`, `Thematic ${i}`),
    )
    const explorationConcepts = Array.from({ length: 10 }, (_, i) =>
      makeExplorationConcept(`ce${i}`, `Exploration ${i}`),
    )

    let engineCallIdx = 0
    vi.mocked(RecommendationEngineClient.queryForShelf).mockImplementation(async () =>
      makeCandidates([`m-pool-${++engineCallIdx}`]),
    )

    // DB mocks for fillMoviesPool sequence:
    // 1. servedItems query
    // 2. sessionConceptRows query
    // 3. conceptRows query (all concepts)
    // 4. maxPosition query
    // Then for each concept: no DB calls (engine returns candidates directly)
    mockDb.select
      .mockReturnValueOnce(makeChain([]))                                               // servedItems
      .mockReturnValueOnce(makeChain([]))                                               // sessionConceptRows
      .mockReturnValueOnce(makeChain([...personalizedConcepts, ...explorationConcepts])) // conceptRows
      .mockReturnValueOnce(makeChain([{ maxPos: -1 }]))                                 // maxPosition
      .mockReturnValue(makeChain([]))

    await fillMoviesPoolAsync(SESSION_ID, PROFILE_ID, 20)

    const types = mockPersistShelfInstance.mock.calls.map((args) => args[0].generationType as string)
    const explorationCount = types.filter((t) => t === 'EXPLORATION' || t === 'DISCOVERY').length
    const totalCount = types.length

    if (totalCount > 0) {
      const ratio = explorationCount / totalCount
      expect(ratio).toBeGreaterThanOrEqual(0.2)
      expect(ratio).toBeLessThanOrEqual(0.3)
    }
  })
})
