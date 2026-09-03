import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  HOME_BATCH_SIZE: 6,
  HOME_ITEMS_MAX: 30,
  HOME_ITEMS_PER_SHELF: 24,
  HOME_POOL_TARGET: 25,
  HOME_SESSION_TTL_HOURS: 24,
  HOME_FRESH_DAYS: 90,
  HERO_MIN_SCORE: 0.55,
  NOUVEAUTES_MIN_ITEMS: 5,
  NOUVEAUTES_ITEMS_PER_SHELF: 20,
}))

// Nouveautés rail is suppressed by default (returns too few items).
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

vi.mock('../shelf-service.js', () => ({ getShelf: vi.fn() }))
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
  recommendationHomeSessions: {},
}))

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  isNull: vi.fn(),
  asc: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
  notInArray: vi.fn(),
  sql: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  or: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p: string | null) => p ? `https://img/${p}` : null),
}))

vi.mock('../hero-selector.js', () => ({
  selectHero: vi.fn(),
}))

import { buildDeclaredRails } from '../home-pool-service.js'
import { getShelf } from '../shelf-service.js'
import { RecommendationEngineClient } from '../../client/recommendation-engine-client.js'
import { ShelfInstanceService } from '../shelf-instance-service.js'
import { ShelfFatigueService } from '../shelf-fatigue-service.js'
import { selectHero } from '../hero-selector.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'
let instanceCounter = 0

const CW_SHELF: ShelfResponse = {
  id: 'sys_continue_watching',
  title: 'Continuer à regarder',
  type: 'SYSTEM',
  layoutHint: 'ROW',
  items: [{ mediaType: 'MOVIE', mediaId: 'cw-movie-1', title: 'Film en cours', posterUrl: null }],
}

function makeCandidates(mediaIds: string[], mediaType: 'MOVIE' | 'SERIES' = 'MOVIE') {
  return {
    candidates: mediaIds.map((id) => ({
      mediaId: id,
      mediaType,
      semanticScore: 0.8,
      profileScore: 0.9,
      finalScore: 0.85,
      reasons: [],
      available: true,
      qualityPrior: 0,
      languageAffinity: 0,
    })),
    queryPlannerVersion: 'v1',
    embeddingModelVersion: 'v1',
    rankerVersion: 'v1',
    candidateCount: mediaIds.length,
  }
}

function makeThematicConcept(id = 'concept-1', title = 'Aventures épiques') {
  return {
    id,
    profileId: PROFILE_ID,
    title,
    rawIntent: title,
    semanticIntent: 'aventures épiques action',
    generationType: 'PERSONALIZED' as const,
    reasonCodes: [],
    sourceModel: 'gpt-4o-mini',
    promptVersion: 'v1',
    desiredMediaTypes: [],
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

// Chain mock: chainable DB query that resolves with given rows.
function makeChain(rows: unknown[] = []) {
  const prom = Promise.resolve(rows)
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
  vi.resetAllMocks()
  instanceCounter = 0

  // Re-establish constructor mocks cleared by vi.resetAllMocks().
  ;(ShelfInstanceService as any).mockImplementation(function () { return { persistShelfInstance: mockPersistShelfInstance } })
  ;(ShelfFatigueService as any).mockImplementation(function () { return { getFatigueStates: mockGetFatigueStates } })

  mockPersistShelfInstance.mockImplementation(() => Promise.resolve(`instance-${++instanceCounter}`))
  mockGetFatigueStates.mockResolvedValue(new Map())

  // By default CW is empty → Rail 1 omitted.
  vi.mocked(getShelf).mockResolvedValue({ id: 'sys_continue_watching', title: 'Continuer à regarder', type: 'SYSTEM', layoutHint: 'ROW', items: [] })

  // No hero by default.
  vi.mocked(selectHero).mockResolvedValue(null)

  // Engine returns empty by default.
  vi.mocked(RecommendationEngineClient.queryForShelf).mockResolvedValue(null)

  // DB: session concepts + concept rows + freshness + enrichment → all empty by default.
  mockDb.select.mockReturnValue(makeChain([]))

  const updateChain = { set: vi.fn(() => updateChain), where: vi.fn(() => Promise.resolve([])) }
  mockDb.update.mockReturnValue(updateChain)
})

// ---------------------------------------------------------------------------
// Helpers to configure happy-path mocks
// ---------------------------------------------------------------------------

function setupEngineRails(opts: {
  cwHasItems?: boolean
  rail2?: string[]
  rail3?: string[]
  rail4Concept?: ReturnType<typeof makeThematicConcept>
  rail4?: string[]
  rail5?: string[]
  rail6?: string[]
}) {
  if (opts.cwHasItems) vi.mocked(getShelf).mockResolvedValue(CW_SHELF)

  const qfs = vi.mocked(RecommendationEngineClient.queryForShelf)

  if (opts.rail2) qfs.mockResolvedValueOnce(makeCandidates(opts.rail2))
  else qfs.mockResolvedValueOnce(null)

  if (opts.rail3) qfs.mockResolvedValueOnce(makeCandidates(opts.rail3))
  else qfs.mockResolvedValueOnce(null)

  if (opts.rail4) qfs.mockResolvedValueOnce(makeCandidates(opts.rail4))
  else qfs.mockResolvedValueOnce(null)

  if (opts.rail5) qfs.mockResolvedValueOnce(makeCandidates(opts.rail5, 'MOVIE'))
  else qfs.mockResolvedValueOnce(null)

  if (opts.rail6) qfs.mockResolvedValueOnce(makeCandidates(opts.rail6, 'SERIES'))
  else qfs.mockResolvedValueOnce(null)

  const concept = opts.rail4Concept ?? makeThematicConcept()

  // DB order matches actual execution: Rail 3 freshness THEN Rail 4 selectThematic THEN enrichment.
  // Rail 3 freshness (only fires when rail3 has candidates; default mediaType is MOVIE → no series call).
  if (opts.rail3 && opts.rail3.length > 0) {
    mockDb.select.mockReturnValueOnce(makeChain(opts.rail3.map((id) => ({ id }))))  // fresh movies
    // no fresh series (all MOVIE)
  }
  // Rail 4 selectThematic
  mockDb.select
    .mockReturnValueOnce(makeChain([]))        // session concept IDs
    .mockReturnValueOnce(makeChain([concept])) // shelf_concepts rows
    // enrichment: all empty (titles will be '')
    .mockReturnValue(makeChain([]))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildDeclaredRails — declaration order', () => {
  it('returns rails in declaration order when all rails have data', async () => {
    setupEngineRails({
      cwHasItems: true,
      rail2: ['m1', 'm2'],
      rail3: ['m3', 'm4'],
      rail4: ['m5'],
      rail5: ['m6'],
      rail6: ['s1'],
    })
    vi.mocked(RecommendationEngineClient.queryForShelf).mockReset()
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1', 'm2']))       // rail 2
      .mockResolvedValueOnce(makeCandidates(['m3', 'm4']))       // rail 3
      .mockResolvedValueOnce(makeCandidates(['m5']))             // rail 4
      .mockResolvedValueOnce(makeCandidates(['m6'], 'MOVIE'))    // rail 5
      .mockResolvedValueOnce(makeCandidates(['s1'], 'SERIES'))   // rail 6

    vi.mocked(getShelf).mockResolvedValue(CW_SHELF)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))                        // session concepts
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))   // concept rows
      .mockReturnValueOnce(makeChain([{ id: 'm3' }, { id: 'm4' }])) // fresh movies (rail 3)
      .mockReturnValueOnce(makeChain([]))                        // fresh series
      .mockReturnValue(makeChain([]))                            // enrichment

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)

    const titles = shelves.map((s) => s.title)
    expect(titles[0]).toBe('Continuer à regarder')
    expect(titles[1]).toBe('Pour toi')
    expect(titles[2]).toBe('Nouveautés pour toi')
    expect(titles[3]).toBe('Aventures épiques')           // dynamic thematic
    expect(titles[4]).toBe('Films pour toi')
    expect(titles[5]).toBe('Séries pour toi')
    expect(shelves).toHaveLength(6)
  })

  it('omits a rail when the engine returns no candidates for it', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1', 'm2']))  // rail 2
      .mockResolvedValueOnce(null)                          // rail 3 — engine unavailable + rankRecommendations returns []
      .mockResolvedValueOnce(null)                          // rail 4 concept query
      .mockResolvedValueOnce(makeCandidates(['m7'], 'MOVIE'))  // rail 5
      .mockResolvedValueOnce(null)                          // rail 6

    // rankRecommendations fallback for rails with null engine result
    const { rankRecommendations: rr } = await import('../recommendation-ranking-service.js')
    vi.mocked(rr).mockResolvedValue({ profileId: PROFILE_ID, coldStart: false, candidates: [] })

    mockDb.select
      .mockReturnValueOnce(makeChain([]))                   // session concepts
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))  // concept rows
      .mockReturnValueOnce(makeChain([]))                   // fresh movies
      .mockReturnValueOnce(makeChain([]))                   // fresh series
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    const titles = shelves.map((s) => s.title)
    expect(titles).toContain('Pour toi')
    expect(titles).not.toContain('Nouveautés pour toi')
    expect(titles).toContain('Films pour toi')
    expect(titles).not.toContain('Séries pour toi')
  })
})

describe('buildDeclaredRails — media-type constraints', () => {
  it('Films rail contains only MOVIE items', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)    // rail 2
      .mockResolvedValueOnce(null)    // rail 3
      .mockResolvedValueOnce(null)    // rail 4
      .mockResolvedValueOnce(makeCandidates(['movie-A', 'movie-B'], 'MOVIE'))  // rail 5
      .mockResolvedValueOnce(null)    // rail 6

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    const filmsRail = shelves.find((s) => s.title === 'Films pour toi')
    expect(filmsRail).toBeDefined()
    expect(filmsRail!.items.every((i) => i.mediaType === 'MOVIE')).toBe(true)
  })

  it('Séries rail contains only SERIES items', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)    // rail 2
      .mockResolvedValueOnce(null)    // rail 3
      .mockResolvedValueOnce(null)    // rail 4
      .mockResolvedValueOnce(null)    // rail 5
      .mockResolvedValueOnce(makeCandidates(['series-A', 'series-B'], 'SERIES'))  // rail 6

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    const seriesRail = shelves.find((s) => s.title === 'Séries pour toi')
    expect(seriesRail).toBeDefined()
    expect(seriesRail!.items.every((i) => i.mediaType === 'SERIES')).toBe(true)
  })
})

describe('buildDeclaredRails — cross-shelf deduplication', () => {
  it('title in rail 2 does not appear in rails 3–6', async () => {
    const sharedId = 'media-shared'

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm2']))   // rail 2 includes sharedId
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm3', 'm4']))  // rail 3 also includes sharedId
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm5']))   // rail 4
      .mockResolvedValueOnce(makeCandidates([sharedId, 'm6'], 'MOVIE')) // rail 5
      .mockResolvedValueOnce(makeCandidates([sharedId, 's1'], 'SERIES')) // rail 6

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      // freshness for rail 3: return m3, m4 as fresh (sharedId filtered by exclusion before freshness)
      .mockReturnValueOnce(makeChain([{ id: 'm3' }, { id: 'm4' }]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)

    const rail2Items = shelves.find((s) => s.title === 'Pour toi')?.items ?? []
    expect(rail2Items.some((i) => i.mediaId === sharedId)).toBe(true)

    for (const shelf of shelves.filter((s) => s.title !== 'Pour toi' && s.title !== 'Continuer à regarder')) {
      expect(shelf.items.some((i) => i.mediaId === sharedId)).toBe(false)
    }
  })

  it('Continuer à regarder items may appear in discovery rails', async () => {
    const cwId = 'cw-movie-1'
    vi.mocked(getShelf).mockResolvedValue(CW_SHELF)

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates([cwId, 'm2']))   // rail 2 includes cwId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)

    const rail2 = shelves.find((s) => s.title === 'Pour toi')
    // CW item can appear in Rail 2 — it is NOT in excludedMediaIds
    expect(rail2?.items.some((i) => i.mediaId === cwId)).toBe(true)
  })
})

describe('buildDeclaredRails — thematic concept fatigue', () => {
  it('skips fatigued concept and uses next eligible one', async () => {
    const fatigued = makeThematicConcept('concept-fatigued', 'Fatigué')
    const eligible = makeThematicConcept('concept-eligible', 'Eligible')

    mockGetFatigueStates.mockResolvedValue(
      new Map([
        ['concept-fatigued', {
          shelfConceptId: 'concept-fatigued',
          impressionCount: 10,
          visibleImpressionCount: 10,
          zeroInteractionStreakCount: 5,
          lastShownAt: new Date().toISOString(),
          cooldownUntil: new Date(Date.now() + 86400_000).toISOString(), // in the future
          suppressionReason: 'zero_interaction_streak',
          suppressionVersion: 'v1',
          updatedAt: new Date().toISOString(),
        }],
      ]),
    )

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([fatigued, eligible]))  // both concepts returned, fatigued first
      .mockReturnValue(makeChain([]))

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)    // rail 2
      .mockResolvedValueOnce(null)    // rail 3
      .mockResolvedValueOnce(makeCandidates(['m5']))  // rail 4 with eligible concept
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    const thematic = shelves.find((s) => s.title === 'Eligible')
    expect(thematic).toBeDefined()
    expect(shelves.find((s) => s.title === 'Fatigué')).toBeUndefined()
  })
})

describe('buildDeclaredRails — error isolation', () => {
  it('engine failure on rail 2 does not prevent rail 5 from rendering', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockRejectedValueOnce(new Error('engine crash'))          // rail 2 throws
      .mockResolvedValueOnce(null)                               // rail 3
      .mockResolvedValueOnce(null)                               // rail 4
      .mockResolvedValueOnce(makeCandidates(['m6'], 'MOVIE'))    // rail 5 succeeds
      .mockResolvedValueOnce(null)                               // rail 6

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Films pour toi')).toBeDefined()
    expect(shelves.find((s) => s.title === 'Pour toi')).toBeUndefined()
  })

  it('persistence failure on one rail does not abort subsequent rails', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1']))   // rail 2
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCandidates(['m6'], 'MOVIE'))  // rail 5
      .mockResolvedValueOnce(null)

    mockPersistShelfInstance
      .mockRejectedValueOnce(new Error('db error'))  // rail 2 persist fails
      .mockResolvedValueOnce('instance-5')            // rail 5 persists

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Films pour toi')).toBeDefined()
    expect(shelves.find((s) => s.title === 'Pour toi')).toBeUndefined()
  })
})

describe('buildDeclaredRails — freshness filter', () => {
  it('excludes candidates outside HOME_FRESH_DAYS from "Nouveautés pour toi"', async () => {
    const freshId = 'fresh-movie'
    const staleId = 'stale-movie'

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)    // rail 2
      // rail 3: engine returns both fresh + stale
      .mockResolvedValueOnce(makeCandidates([freshId, staleId]))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      // Rail 3 freshness runs before Rail 4 selectThematic
      .mockReturnValueOnce(makeChain([{ id: freshId }]))        // fresh movies (Rail 3)
      .mockReturnValueOnce(makeChain([]))                        // session concepts (Rail 4)
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))   // concept rows (Rail 4)
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    const nouveautes = shelves.find((s) => s.title === 'Nouveautés pour toi')
    expect(nouveautes).toBeDefined()
    expect(nouveautes!.items.map((i) => i.mediaId)).toEqual([freshId])
    expect(nouveautes!.items.map((i) => i.mediaId)).not.toContain(staleId)
  })

  it('omits "Nouveautés pour toi" when all candidates fail freshness filter', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCandidates(['stale-1', 'stale-2']))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValueOnce(makeChain([]))  // no fresh movies
      .mockReturnValueOnce(makeChain([]))  // no fresh series
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Nouveautés pour toi')).toBeUndefined()
  })
})

describe('buildDeclaredRails — nextPoolPosition', () => {
  it('returns nextPoolPosition equal to the count of persisted declared rails', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates(['m1']))   // rail 2
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeCandidates(['m6'], 'MOVIE'))  // rail 5
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { nextPoolPosition } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
    // Rails 2 and 5 succeed → positions 0 and 1 → nextPoolPosition = 2
    expect(nextPoolPosition).toBe(2)
  })
})

describe('buildDeclaredRails — hero exclusion from Pour toi', () => {
  it('hero mediaId is excluded from Pour toi items', async () => {
    const heroId = 'm1'

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates([heroId, 'm2', 'm3']))  // rail 2
      .mockResolvedValueOnce(null)   // rail 3
      .mockResolvedValueOnce(null)   // rail 4
      .mockResolvedValueOnce(null)   // rail 5
      .mockResolvedValueOnce(null)   // rail 6

    vi.mocked(selectHero).mockResolvedValueOnce({
      mediaId: heroId,
      mediaType: 'MOVIE',
      title: 'Hero Film',
      synopsis: null,
      backdropUrl: 'https://img/backdrop.jpg',
      availabilityStatus: 'available',
      trailerKey: null,
    })

    mockDb.select
      .mockReturnValueOnce(makeChain([]))                         // session concepts
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))    // concept rows
      .mockReturnValue(makeChain([]))                             // enrichment

    const { shelves, hero } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)

    const pourToi = shelves.find((s) => s.title === 'Pour toi')
    expect(pourToi).toBeDefined()
    expect(pourToi!.items.some((i) => i.mediaId === heroId)).toBe(false)
    expect(pourToi!.items.map((i) => i.mediaId)).toEqual(['m2', 'm3'])
    expect(hero?.mediaId).toBe(heroId)
  })

  it('Pour toi is omitted entirely when the only candidate becomes the hero', async () => {
    const heroId = 'sole-candidate'

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeCandidates([heroId]))  // rail 2: single candidate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    vi.mocked(selectHero).mockResolvedValueOnce({
      mediaId: heroId,
      mediaType: 'MOVIE',
      title: 'Solo Hero',
      synopsis: null,
      backdropUrl: 'https://img/bd.jpg',
      availabilityStatus: 'available',
      trailerKey: null,
    })

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeThematicConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves, hero } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)

    expect(shelves.find((s) => s.title === 'Pour toi')).toBeUndefined()
    expect(hero?.mediaId).toBe(heroId)
  })
})
