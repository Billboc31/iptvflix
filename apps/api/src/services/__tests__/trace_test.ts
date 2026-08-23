import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../../config/env.js', () => ({
  HOME_BATCH_SIZE: 6, HOME_ITEMS_MAX: 30, HOME_ITEMS_PER_SHELF: 24,
  HOME_POOL_TARGET: 25, HOME_SESSION_TTL_HOURS: 24, HOME_FRESH_DAYS: 90,
}))

const mockPersistShelfInstance = vi.hoisted(() => vi.fn())
const mockGetFatigueStates = vi.hoisted(() => vi.fn())
vi.mock('../shelf-instance-service.js', () => ({ ShelfInstanceService: vi.fn().mockImplementation(() => ({ persistShelfInstance: mockPersistShelfInstance })) }))
vi.mock('../shelf-fatigue-service.js', () => ({ ShelfFatigueService: vi.fn().mockImplementation(() => ({ getFatigueStates: mockGetFatigueStates })) }))

const mockDb = vi.hoisted(() => ({ select: vi.fn(), update: vi.fn(), insert: vi.fn() }))
vi.mock('../../db/client.js', () => ({ db: mockDb }))
vi.mock('../shelf-service.js', () => ({ getShelf: vi.fn() }))
vi.mock('../recommendation-ranking-service.js', () => ({ rankRecommendations: vi.fn() }))
vi.mock('../../client/recommendation-engine-client.js', () => ({ RecommendationEngineClient: { queryForShelf: vi.fn() } }))
vi.mock('../../db/schema/index.js', () => ({ shelfInstances: {}, shelfInstanceItems: {}, shelfConcepts: {}, movies: {}, series: {}, mediaVideos: {}, movieAvailabilities: {}, recommendationHomeSessions: {} }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn(), isNull: vi.fn(), asc: vi.fn(), count: vi.fn(), inArray: vi.fn(), notInArray: vi.fn(), sql: vi.fn(), desc: vi.fn(), gte: vi.fn(), or: vi.fn() }))
vi.mock('../../lib/tmdb-image.js', () => ({ resolveMediaImageUrl: vi.fn((p: string | null) => p ? `https://img/${p}` : null) }))

import { buildDeclaredRails } from '../home-pool-service.js'
import { getShelf } from '../shelf-service.js'
import { RecommendationEngineClient } from '../../client/recommendation-engine-client.js'

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SESSION_ID = '00000000-0000-0000-0000-000000000099'

function makeCandidates(mediaIds: string[], mediaType: 'MOVIE' | 'SERIES' = 'MOVIE') {
  return { candidates: mediaIds.map(id => ({ mediaId: id, mediaType, semanticScore: 0.8, profileScore: 0.9, finalScore: 0.85, reasons: [], available: true })), queryPlannerVersion: 'v1', embeddingModelVersion: 'v1', rankerVersion: 'v1', candidateCount: mediaIds.length }
}

function makeThematicConcept() {
  return { id: 'concept-1', profileId: PROFILE_ID, title: 'Aventures épiques', rawIntent: 'x', semanticIntent: 'aventures', generationType: 'PERSONALIZED', reasonCodes: [], sourceModel: 'gpt-4o-mini', promptVersion: 'v1', desiredMediaTypes: [], semanticAnchor: null, freshnessPolicy: null, active: true, createdAt: new Date(), expiresAt: null, reachCount: 0, openCount: 0, playCount: 0, completionCount: 0, dismissCount: 0 }
}

let dbCallN = 0
function makeChain(rows: unknown[] = [], label = '') {
  const prom = Promise.resolve(rows)
  const chain: Record<string, unknown> = { from: vi.fn(() => chain), where: vi.fn(() => chain), orderBy: vi.fn(() => chain), limit: vi.fn(() => prom), then: prom.then.bind(prom), catch: prom.catch.bind(prom), finally: prom.finally.bind(prom) }
  return chain
}

beforeEach(() => {
  vi.clearAllMocks()
  dbCallN = 0
  mockPersistShelfInstance.mockImplementation(() => Promise.resolve(`inst-${++dbCallN}`))
  mockGetFatigueStates.mockResolvedValue(new Map())
  vi.mocked(getShelf).mockResolvedValue({ id: 'sys_continue_watching', title: 'Continuer à regarder', type: 'SYSTEM', layoutHint: 'ROW', items: [] })
  vi.mocked(RecommendationEngineClient.queryForShelf).mockResolvedValue(null)
  
  let selectN = 0
  mockDb.select.mockImplementation(() => {
    selectN++
    console.log(`[SELECT #${selectN}] called`)
    return makeChain([])
  })
  
  const updateChain = { set: vi.fn(() => updateChain), where: vi.fn(() => Promise.resolve([])) }
  mockDb.update.mockReturnValue(updateChain)
})

it('TRACE: Films rail with selectN logging', async () => {
  let selectN = 0
  const calls: string[] = []
  
  mockDb.select
    .mockReturnValueOnce((() => { calls.push('1st-once'); return makeChain([]) })())
    .mockReturnValueOnce((() => { calls.push('2nd-once'); return makeChain([makeThematicConcept()]) })())
    .mockReturnValue((() => { calls.push('default'); return makeChain([]) })())

  vi.mocked(RecommendationEngineClient.queryForShelf)
    .mockResolvedValueOnce(null)    // rail 2
    .mockResolvedValueOnce(null)    // rail 3
    .mockResolvedValueOnce(null)    // rail 4
    .mockResolvedValueOnce(makeCandidates(['movie-A', 'movie-B'], 'MOVIE'))  // rail 5
    .mockResolvedValueOnce(null)    // rail 6

  const { shelves } = await buildDeclaredRails(PROFILE_ID, SESSION_ID)
  console.log('FINAL shelves:', shelves.map(s => s.title))
  console.log('DB select calls pattern:', calls)
  
  const filmsRail = shelves.find(s => s.title === 'Films pour toi')
  expect(filmsRail).toBeDefined()
})
