import { describe, it, expect, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Module mocks (hoisted)
// ---------------------------------------------------------------------------

vi.mock('../../config/env.js', () => ({
  SERIES_BATCH_SIZE: 6,
  SERIES_ITEMS_MAX: 30,
  SERIES_ITEMS_PER_SHELF: 24,
  SERIES_POOL_TARGET: 25,
  SERIES_SESSION_TTL_HOURS: 24,
  SERIES_FRESH_DAYS: 90,
}))

const mockPersistShelfInstance = vi.hoisted(() => vi.fn())
const mockGetFatigueStates = vi.hoisted(() => vi.fn())

vi.mock('../shelf-instance-service.js', () => ({
  ShelfInstanceService: vi.fn().mockImplementation(() => ({
    persistShelfInstance: mockPersistShelfInstance,
  })),
}))

vi.mock('../shelf-fatigue-service.js', () => ({
  ShelfFatigueService: vi.fn().mockImplementation(() => ({
    getFatigueStates: mockGetFatigueStates,
  })),
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
  series: {},
  mediaVideos: {},
  recommendationSeriesSessions: {},
  viewingProgress: {},
  episodes: {},
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
  gt: vi.fn(),
}))

vi.mock('../../lib/tmdb-image.js', () => ({
  resolveMediaImageUrl: vi.fn((p: string | null) => p ? `https://img/${p}` : null),
}))

import { buildSeriesDeclaredRails } from '../series-pool-service.js'
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

function makeSeriesCandidates(mediaIds: string[]) {
  return {
    candidates: mediaIds.map((id) => ({
      mediaId: id,
      mediaType: 'SERIES',
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

function makeExploitationConcept(id = 'concept-1', title = 'Séries d\'action') {
  return {
    id,
    profileId: PROFILE_ID,
    title,
    rawIntent: title,
    semanticIntent: 'séries action aventure',
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

function makeExplorationConcept(id = 'concept-explore', title = 'Séries coréennes mystère') {
  return { ...makeExploitationConcept(id, title), generationType: 'EXPLORATION' as const }
}

function makeChain(rows: unknown[] = []) {
  const prom = Promise.resolve(rows)
  const chain: Record<string, unknown> = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => prom),
    innerJoin: vi.fn(() => chain),
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

  ;(ShelfInstanceService as any).mockImplementation(() => ({ persistShelfInstance: mockPersistShelfInstance }))
  ;(ShelfFatigueService as any).mockImplementation(() => ({ getFatigueStates: mockGetFatigueStates }))

  mockPersistShelfInstance.mockImplementation(() => Promise.resolve(`instance-${++instanceCounter}`))
  mockGetFatigueStates.mockResolvedValue(new Map())

  vi.mocked(RecommendationEngineClient.queryForShelf).mockResolvedValue(null)
  vi.mocked(rankRecommendations).mockResolvedValue({ candidates: [] } as any)

  mockDb.select.mockReturnValue(makeChain([]))

  const updateChain = { set: vi.fn(() => updateChain), where: vi.fn(() => Promise.resolve([])) }
  mockDb.update.mockReturnValue(updateChain)
})

// ---------------------------------------------------------------------------
// Series-only constraint
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — series-only constraint', () => {
  it('passes mediaTypeFilter SERIES to every queryForShelf call', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeSeriesCandidates(['s1', 's2']))  // rail 1
      .mockResolvedValueOnce(null)                                  // rail 2
      .mockResolvedValueOnce(null)                                  // thematic 1
      .mockResolvedValueOnce(null)                                  // thematic 2
      .mockResolvedValueOnce(null)                                  // exploration

    mockDb.select
      .mockReturnValueOnce(makeChain([]))  // in-progress series
      .mockReturnValueOnce(makeChain([{ id: 's1' }]))  // freshness
      .mockReturnValueOnce(makeChain([]))  // exploitation concepts
      .mockReturnValueOnce(makeChain([]))  // exploitation concepts 2
      .mockReturnValueOnce(makeChain([]))  // exploration concepts
      .mockReturnValue(makeChain([]))

    await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)

    const calls = vi.mocked(RecommendationEngineClient.queryForShelf).mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const call of calls) {
      expect(call[0].mediaTypeFilter).toBe('SERIES')
    }
  })

  it('all shelf items have mediaType SERIES', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeSeriesCandidates(['s1', 's2']))  // rail 1
      .mockResolvedValueOnce(makeSeriesCandidates(['s3']))         // rail 2
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))         // in-progress
      .mockReturnValueOnce(makeChain([{ id: 's3' }]))  // freshness
      .mockReturnValueOnce(makeChain([]))          // exploitation 1
      .mockReturnValueOnce(makeChain([]))          // exploitation 2
      .mockReturnValueOnce(makeChain([]))          // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)

    for (const shelf of shelves) {
      for (const item of shelf.items) {
        expect(item.mediaType).toBe('SERIES')
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Exploitation / exploration composition
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — exploitation/exploration composition', () => {
  it('produces at least one EXPLORATION rail when exploration concept exists with sufficient candidates', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)    // rail 1 (no candidates → skipped)
      .mockResolvedValueOnce(null)    // rail 2 (no candidates → skipped)
      // thematic 1 & 2: exploitation concepts return [] → queryForShelf never called
      // exploration: must return >= SERIES_ITEMS_PER_SHELF/4 = 6 candidates
      .mockResolvedValueOnce(makeSeriesCandidates(['e1','e2','e3','e4','e5','e6','e7']))

    mockDb.select
      .mockReturnValueOnce(makeChain([]))  // in-progress
      .mockReturnValueOnce(makeChain([]))  // exploitation concepts 1
      .mockReturnValueOnce(makeChain([]))  // exploitation concepts 2
      .mockReturnValueOnce(makeChain([makeExplorationConcept()]))  // exploration concepts
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)

    const explorationShelf = shelves.find((s) => s.title === 'Séries coréennes mystère')
    expect(explorationShelf).toBeDefined()
  })

  it('omits exploration rail when engine returns fewer candidates than minimum threshold', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)  // rail 1 (no candidates → skipped)
      .mockResolvedValueOnce(null)  // rail 2 (no candidates → skipped)
      // thematic 1 & 2: exploitation concepts return [] → queryForShelf never called
      .mockResolvedValueOnce(makeSeriesCandidates(['e1', 'e2']))  // exploration: only 2, below threshold

    mockDb.select
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([makeExplorationConcept()]))
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Séries coréennes mystère')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Theme diversity
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — theme diversity', () => {
  it('does not use the same concept twice', async () => {
    const concept = makeExploitationConcept('concept-dup', 'Séries drama')

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeSeriesCandidates(['s5']))   // thematic 1 gets concept
      .mockResolvedValueOnce(makeSeriesCandidates(['s6']))   // thematic 2 should get a different concept or nothing
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))       // in-progress
      .mockReturnValueOnce(makeChain([concept]))  // exploitation concepts 1
      .mockReturnValueOnce(makeChain([concept]))  // exploitation concepts 2 — same concept returned (should be filtered)
      .mockReturnValueOnce(makeChain([]))        // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)

    const conceptShelves = shelves.filter((s) => s.title === 'Séries drama')
    expect(conceptShelves.length).toBeLessThanOrEqual(1)
  })
})

// ---------------------------------------------------------------------------
// Cross-shelf deduplication
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — cross-shelf deduplication', () => {
  it('same mediaId does not appear in more than one shelf', async () => {
    const sharedId = 'shared-series'

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeSeriesCandidates([sharedId, 's2']))   // rail 1 includes sharedId
      .mockResolvedValueOnce(makeSeriesCandidates([sharedId, 's3']))   // rail 2 also tries sharedId
      .mockResolvedValueOnce(makeSeriesCandidates([sharedId, 's4']))   // thematic 1
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))                          // in-progress
      .mockReturnValueOnce(makeChain([{ id: 's3' }]))              // freshness (sharedId not fresh → not here)
      .mockReturnValueOnce(makeChain([makeExploitationConcept()])) // exploitation 1
      .mockReturnValueOnce(makeChain([]))                          // exploitation 2
      .mockReturnValueOnce(makeChain([]))                          // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)

    const allMediaIds = shelves.flatMap((s) => s.items.map((i) => i.mediaId))
    const seen = new Set<string>()
    for (const id of allMediaIds) {
      expect(seen.has(id)).toBe(false)
      seen.add(id)
    }
  })
})

// ---------------------------------------------------------------------------
// Snapshot/cache reuse (via buildSeriesDeclaredRails call count)
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — empty rail behavior', () => {
  it('omits a rail when the engine returns no candidates', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(null)   // rail 1 — no candidates
      .mockResolvedValueOnce(makeSeriesCandidates(['s3']))  // rail 2 gets candidates
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    const { rankRecommendations: rr } = await import('../recommendation-ranking-service.js')
    vi.mocked(rr).mockResolvedValue({ profileId: PROFILE_ID, coldStart: false, candidates: [] })

    mockDb.select
      .mockReturnValueOnce(makeChain([]))                    // in-progress
      .mockReturnValueOnce(makeChain([{ id: 's3' }]))        // freshness for rail 2
      .mockReturnValueOnce(makeChain([]))                    // exploitation 1
      .mockReturnValueOnce(makeChain([]))                    // exploitation 2
      .mockReturnValueOnce(makeChain([]))                    // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Séries pour toi')).toBeUndefined()
    expect(shelves.find((s) => s.title === 'Nouvelles séries pour toi')).toBeDefined()
  })

  it('shelfInstanceIds is empty when no rails produce any items', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf).mockResolvedValue(null)
    const { rankRecommendations: rr } = await import('../recommendation-ranking-service.js')
    vi.mocked(rr).mockResolvedValue({ profileId: PROFILE_ID, coldStart: false, candidates: [] })

    mockDb.select
      .mockReturnValueOnce(makeChain([]))  // in-progress
      .mockReturnValueOnce(makeChain([]))  // freshness
      .mockReturnValueOnce(makeChain([]))  // exploitation 1
      .mockReturnValueOnce(makeChain([]))  // exploitation 2
      .mockReturnValueOnce(makeChain([]))  // exploration
      .mockReturnValue(makeChain([]))

    const { shelves, shelfInstanceIds } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves).toHaveLength(0)
    expect(shelfInstanceIds).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// In-progress series exclusion
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — in-progress series exclusion', () => {
  it('does not include active in-progress series in discovery rails', async () => {
    const inProgressSeriesId = 'active-series-1'

    // In-progress query returns this series
    mockDb.select.mockReturnValueOnce(makeChain([{ seriesId: inProgressSeriesId }]))

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeSeriesCandidates([inProgressSeriesId, 's2', 's3']))  // rail 1 includes it
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))  // freshness
      .mockReturnValueOnce(makeChain([]))  // exploitation 1
      .mockReturnValueOnce(makeChain([]))  // exploitation 2
      .mockReturnValueOnce(makeChain([]))  // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)

    for (const shelf of shelves) {
      expect(shelf.items.some((i) => i.mediaId === inProgressSeriesId)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Error isolation
// ---------------------------------------------------------------------------

describe('buildSeriesDeclaredRails — error isolation', () => {
  it('engine failure on rail 1 does not prevent rail 2 from rendering', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockRejectedValueOnce(new Error('engine crash'))           // rail 1 throws
      .mockResolvedValueOnce(makeSeriesCandidates(['s3', 's4']))  // rail 2 succeeds
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))          // in-progress
      .mockReturnValueOnce(makeChain([{ id: 's3' }, { id: 's4' }]))  // freshness
      .mockReturnValueOnce(makeChain([]))          // exploitation 1
      .mockReturnValueOnce(makeChain([]))          // exploitation 2
      .mockReturnValueOnce(makeChain([]))          // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Nouvelles séries pour toi')).toBeDefined()
    expect(shelves.find((s) => s.title === 'Séries pour toi')).toBeUndefined()
  })

  it('persistence failure on one rail does not abort subsequent rails', async () => {
    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockResolvedValueOnce(makeSeriesCandidates(['s1']))  // rail 1
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockPersistShelfInstance
      .mockRejectedValueOnce(new Error('db error'))
      .mockResolvedValueOnce('instance-2')

    vi.mocked(RecommendationEngineClient.queryForShelf)
      .mockReset()
      .mockResolvedValueOnce(makeSeriesCandidates(['s1']))  // rail 1 — persist fails
      .mockResolvedValueOnce(makeSeriesCandidates(['s3', 's4']))  // rail 2 — persist succeeds
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)

    mockDb.select
      .mockReturnValueOnce(makeChain([]))          // in-progress
      .mockReturnValueOnce(makeChain([{ id: 's3' }, { id: 's4' }]))  // freshness
      .mockReturnValueOnce(makeChain([]))          // exploitation 1
      .mockReturnValueOnce(makeChain([]))          // exploitation 2
      .mockReturnValueOnce(makeChain([]))          // exploration
      .mockReturnValue(makeChain([]))

    const { shelves } = await buildSeriesDeclaredRails(PROFILE_ID, SESSION_ID)
    expect(shelves.find((s) => s.title === 'Nouvelles séries pour toi')).toBeDefined()
  })
})
