import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ShelfConceptGeneratorService } from '../shelf-concept-generator-service.js'
import type { ShelfConcept, ProfileTaste } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockGetTaste = vi.hoisted(() => vi.fn())
vi.mock('../profile-taste-service.js', () => ({ getTaste: mockGetTaste }))

vi.mock('../../config/env.js', () => ({
  SHELF_CONCEPT_PERSONALIZED_RATIO: 0.7,
  SHELF_CONCEPT_EXPLORATION_RATIO: 0.2,
  SHELF_CONCEPT_DISCOVERY_RATIO: 0.1,
  SHELF_CONCEPT_BATCH_SIZE: 20,
  SHELF_CONCEPT_TTL_HOURS: 48,
  SHELF_CONCEPT_MIN_POOL_SIZE: 8,
  SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD: 0.85,
}))

// ---------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------

const PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const PROFILE_ID_2 = '00000000-0000-0000-0000-000000000002'

const T100_TASTE_FIELDS = {
  personScores: {},
  personMeta: {},
  keywordScores: {},
  franchiseScores: {},
  languageScores: {},
  countryScores: {},
  decadeScores: {},
  mediaTypePreferences: {},
  completionRate: null,
  historyEventCount: 0,
  tasteVersion: 1,
  dislikedMediaIds: [] as string[],
  notInterestedMediaIds: [] as string[],
}

const WARM_TASTE: ProfileTaste = {
  profileId: PROFILE_ID,
  genreScores: [
    { genreId: 'g1', slug: 'action', name: 'Action', score: 5 },
    { genreId: 'g2', slug: 'thriller', name: 'Thriller', score: 3 },
  ],
  positiveMediaIds: ['m1', 'm2', 'm3'],
  negativeMediaIds: ['m4'],
  signalCount: 15,
  builtAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  ...T100_TASTE_FIELDS,
}

const COLD_TASTE: ProfileTaste = {
  profileId: PROFILE_ID,
  genreScores: [],
  positiveMediaIds: [],
  negativeMediaIds: [],
  signalCount: 0,
  builtAt: new Date('2026-01-01T00:00:00Z').toISOString(),
  ...T100_TASTE_FIELDS,
}

// ---------------------------------------------------------------------------
// DB mock helpers
// ---------------------------------------------------------------------------

type MockDb = ReturnType<typeof makeMockDb>

function makeMockDb() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }
}

/**
 * Flexible thenable chain mock: works regardless of whether the caller uses
 * .where(), .orderBy(), .limit(), or any combination thereof, in any order.
 * Awaiting the chain at any point resolves to `rows`.
 */
function makeDbChain(rows: unknown[]): Record<string, unknown> {
  const promise = Promise.resolve(rows)
  // chain is both thenable AND has all query builder methods
  const chain: Record<string, unknown> = {
    then: (r: Parameters<typeof promise.then>[0], j?: Parameters<typeof promise.then>[1]) =>
      promise.then(r, j),
    catch: (r: Parameters<typeof promise.catch>[0]) => promise.catch(r),
  }
  chain['where'] = vi.fn().mockReturnValue(chain)
  chain['orderBy'] = vi.fn().mockReturnValue(chain)
  chain['limit'] = vi.fn().mockReturnValue(promise)
  return chain
}

/** Queue one select mock that resolves to `rows` regardless of query chain used. */
function queueSelect(db: MockDb, rows: unknown[]) {
  db.select.mockReturnValueOnce({
    from: vi.fn().mockReturnValue(makeDbChain(rows)),
  })
}

/** Queue N empty-array selects */
function queueEmptySelects(db: MockDb, count: number) {
  for (let i = 0; i < count; i++) queueSelect(db, [])
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(
  db: MockDb,
  openai: unknown = null,
  embeddingProvider: unknown = null,
  semanticRetrieval: unknown = null,
  model = 'gpt-4o-mini',
) {
  return new ShelfConceptGeneratorService(
    db as never,
    openai as never,
    embeddingProvider as never,
    semanticRetrieval as never,
    model,
  )
}

function makeConcept(overrides: Partial<ShelfConcept> = {}): ShelfConcept {
  return {
    id: 'c1',
    profileId: PROFILE_ID,
    title: 'SF qui fait réfléchir',
    rawIntent: 'Cerebral science fiction films',
    semanticIntent:
      'Science fiction films that provoke thought about consciousness, AI, and the human condition.',
    generationType: 'PERSONALIZED',
    reasonCodes: ['top_genre:scifi'],
    sourceModel: 'gpt-4o-mini',
    promptVersion: 'shelf-concept-v1',
    desiredMediaTypes: ['MOVIE'],
    freshnessPolicy: null,
    active: true,
    createdAt: new Date().toISOString(),
    expiresAt: null,
    reachCount: 0,
    openCount: 0,
    playCount: 0,
    completionCount: 0,
    dismissCount: 0,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildProfileContext
// ---------------------------------------------------------------------------

describe('ShelfConceptGeneratorService.buildProfileContext — warm profile', () => {
  beforeEach(() => {
    mockGetTaste.mockResolvedValue(WARM_TASTE)
  })

  it('returns non-empty taste signals and coldStart = false', async () => {
    const db = makeMockDb()
    // 5 initial selects: profiles, interactionEvents, shelfConcepts, discoveryCandidate
    // (getTaste is mocked at module level — not a DB select)
    queueSelect(db, [{ isKids: false, preferredAudioLanguages: ['fr'] }]) // profiles
    queueSelect(db, []) // interactionEvents
    queueSelect(db, []) // shelfConcepts
    queueSelect(db, [{ title: 'New Release A' }]) // discoveryCandidate
    // 4 title-lookup selects (compMovies, compSeries, abanMovies, abanSeries) — all empty
    queueEmptySelects(db, 4)

    const svc = makeService(db)
    const ctx = await svc.buildProfileContext(PROFILE_ID)

    expect(ctx.coldStart).toBe(false)
    expect(ctx.topGenres).toContain('Action')
    expect(ctx.isKids).toBe(false)
    expect(ctx.languagePreferences).toEqual(['fr'])
    expect(ctx.newCatalogSignals).toContain('New Release A')
  })
})

describe('ShelfConceptGeneratorService.buildProfileContext — cold profile', () => {
  beforeEach(() => {
    mockGetTaste.mockResolvedValue(COLD_TASTE)
  })

  it('returns coldStart = true and empty personal signals', async () => {
    const db = makeMockDb()
    queueSelect(db, [{ isKids: true, preferredAudioLanguages: [] }])
    queueSelect(db, [])
    queueSelect(db, [])
    queueSelect(db, [])
    queueEmptySelects(db, 4)

    const svc = makeService(db)
    const ctx = await svc.buildProfileContext(PROFILE_ID)

    expect(ctx.coldStart).toBe(true)
    expect(ctx.topGenres).toHaveLength(0)
    expect(ctx.recentCompletions).toHaveLength(0)
    expect(ctx.recentShelfConcepts).toHaveLength(0)
    expect(ctx.isKids).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// validateConcept
// ---------------------------------------------------------------------------

describe('ShelfConceptGeneratorService.validateConcept — schema failures', () => {
  const svc = makeService(makeMockDb())

  it('rejects concept with empty title', () => {
    const result = svc.validateConcept(
      {
        title: '',
        rawIntent: 'some intent',
        semanticIntent: 'some semantic intent',
        generationType: 'PERSONALIZED',
        reasonCodes: [],
        desiredMediaTypes: ['MOVIE'],
        freshnessPolicy: null,
      },
      [],
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('title')
  })

  it('rejects invalid generationType', () => {
    const result = svc.validateConcept(
      {
        title: 'Valid Title',
        rawIntent: 'some intent',
        semanticIntent: 'some semantic intent for embedding purposes',
        generationType: 'INVALID_TYPE',
        reasonCodes: [],
        desiredMediaTypes: ['MOVIE'],
        freshnessPolicy: null,
      },
      [],
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('generationType')
  })

  it('rejects invalid desiredMediaTypes', () => {
    const result = svc.validateConcept(
      {
        title: 'Valid Title',
        rawIntent: 'some intent',
        semanticIntent: 'some semantic intent',
        generationType: 'DISCOVERY',
        reasonCodes: [],
        desiredMediaTypes: ['BOOK'],
        freshnessPolicy: null,
      },
      [],
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('desiredMediaTypes')
  })

  it('rejects invalid freshnessPolicy', () => {
    const result = svc.validateConcept(
      {
        title: 'Valid Title',
        rawIntent: 'some intent',
        semanticIntent: 'some semantic intent',
        generationType: 'DISCOVERY',
        reasonCodes: [],
        desiredMediaTypes: ['MOVIE', 'SERIES'],
        freshnessPolicy: 'TOMORROW',
      },
      [],
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.reason).toContain('freshnessPolicy')
  })

  it('accepts a fully valid concept', () => {
    const result = svc.validateConcept(
      {
        title: 'Thrillers en huis clos',
        rawIntent: 'Claustrophobic psychological thrillers',
        semanticIntent:
          'Claustrophobic psychological thrillers set in confined spaces where trust is impossible. Slow-burn tension with unreliable characters.',
        generationType: 'PERSONALIZED',
        reasonCodes: ['top_genre:thriller'],
        desiredMediaTypes: ['MOVIE'],
        freshnessPolicy: 'ALL',
      },
      [],
    )
    expect(result.valid).toBe(true)
  })
})

describe('ShelfConceptGeneratorService.validateConcept — ignored concept filter', () => {
  const svc = makeService(makeMockDb())

  it('rejects a concept too similar to a persistently ignored one', () => {
    const ignored = makeConcept({
      semanticIntent:
        'Science fiction films that provoke thought about consciousness and artificial intelligence.',
      dismissCount: 10,
      openCount: 0,
    })
    const result = svc.validateConcept(
      {
        title: 'SF cérébrale',
        rawIntent: 'Cerebral SF',
        semanticIntent: 'Science fiction films that provoke thought about consciousness.',
        generationType: 'PERSONALIZED',
        reasonCodes: [],
        desiredMediaTypes: ['MOVIE'],
        freshnessPolicy: null,
      },
      [ignored],
    )
    expect(result.valid).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// needsRefresh
// ---------------------------------------------------------------------------

describe('ShelfConceptGeneratorService.needsRefresh', () => {
  beforeEach(() => {
    mockGetTaste.mockResolvedValue(WARM_TASTE)
  })

  it('returns true when pool is below minimum size', async () => {
    const db = makeMockDb()
    queueSelect(db, []) // getActivePool → empty pool
    const svc = makeService(db)
    const result = await svc.needsRefresh(PROFILE_ID)
    expect(result).toBe(true)
  })

  it('returns false when pool is fresh and large enough', async () => {
    const db = makeMockDb()
    const freshConcepts = Array.from({ length: 10 }, (_, i) =>
      makeConcept({ id: `c${i}`, createdAt: new Date().toISOString() }),
    ).map((c) => ({
      ...c,
      createdAt: new Date(c.createdAt),
      expiresAt: null,
    }))

    queueSelect(db, freshConcepts)
    mockGetTaste.mockResolvedValue({
      ...WARM_TASTE,
      builtAt: new Date('2020-01-01T00:00:00Z').toISOString(), // older than concepts
    })

    const svc = makeService(db)
    const result = await svc.needsRefresh(PROFILE_ID)
    expect(result).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// generateConcepts — two profiles produce different concept sets
// ---------------------------------------------------------------------------

describe('ShelfConceptGeneratorService.generateConcepts', () => {
  const WARM_TASTE_2: ProfileTaste = {
    profileId: PROFILE_ID_2,
    genreScores: [
      { genreId: 'g5', slug: 'animation', name: 'Animation', score: 8 },
      { genreId: 'g6', slug: 'comedy', name: 'Comedy', score: 4 },
    ],
    positiveMediaIds: ['s1', 's2'],
    negativeMediaIds: [],
    signalCount: 20,
    builtAt: new Date('2026-01-01T00:00:00Z').toISOString(),
    ...T100_TASTE_FIELDS,
  }

  function makeLlmResponse(concepts: object[]) {
    return {
      choices: [{ message: { content: JSON.stringify({ concepts }) } }],
    }
  }

  function makeEmbeddingProviderMock() {
    let callCount = 0
    return {
      embed: vi.fn().mockImplementation(() => {
        // Different vectors per call to avoid dedup
        const v = new Array(4).fill(0).map((_, i) => (i === callCount % 4 ? 1 : 0))
        callCount++
        return Promise.resolve(v)
      }),
    }
  }

  function makeRetrievalMock(resultCount = 5) {
    return {
      retrieve: vi.fn().mockResolvedValue(
        Array.from({ length: resultCount }, (_, i) => ({
          mediaId: `m${i}`,
          mediaType: 'MOVIE',
          title: `Movie ${i}`,
          similarity: 0.9,
          rank: i + 1,
          year: 2020 + i,
          posterPath: null,
          modelProvider: 'openai',
          modelName: 'text-embedding-3-small',
        })),
      ),
    }
  }

  function setupDbForGenerate(db: MockDb, taste: ProfileTaste) {
    mockGetTaste.mockResolvedValue(taste)
    // buildProfileContext: profiles, interactionEvents, shelfConcepts, discoveryCandidate + 4 title lookups
    queueSelect(db, [{ isKids: false, preferredAudioLanguages: [] }])
    queueSelect(db, [])
    queueSelect(db, [])
    queueSelect(db, [])
    queueEmptySelects(db, 4)
    // getActivePool inside generateConcepts (existing concepts)
    queueSelect(db, [])
  }

  function setupDbInsertReturning(db: MockDb, conceptRow: object) {
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([conceptRow]),
      }),
    })
  }

  function makeInsertedRow(overrides: object) {
    return {
      id: 'c1',
      profileId: PROFILE_ID,
      active: true,
      createdAt: new Date(),
      expiresAt: null,
      reachCount: 0,
      openCount: 0,
      playCount: 0,
      completionCount: 0,
      dismissCount: 0,
      sourceModel: 'gpt-4o-mini',
      promptVersion: 'shelf-concept-v1',
      ...overrides,
    }
  }

  it('produces materially different rawIntents for profiles with different taste histories', async () => {
    const db1 = makeMockDb()
    const db2 = makeMockDb()

    const concept1 = {
      title: 'Thrillers psychologiques',
      rawIntent: 'Psychological thrillers with unreliable narrators',
      semanticIntent: 'Psychological thriller films with unreliable narrators and dark secrets. Slow-burn tension.',
      generationType: 'PERSONALIZED',
      reasonCodes: ['top_genre:thriller'],
      desiredMediaTypes: ['MOVIE'],
      freshnessPolicy: null,
    }

    const concept2 = {
      title: 'Anime à binge-watcher',
      rawIntent: 'Binge-worthy anime series with compelling storylines',
      semanticIntent: 'Anime series perfect for marathon viewing. Rich world-building and character development.',
      generationType: 'PERSONALIZED',
      reasonCodes: ['top_genre:animation', 'binge_tendency'],
      desiredMediaTypes: ['SERIES'],
      freshnessPolicy: null,
    }

    const openai1 = {
      chat: { completions: { create: vi.fn().mockResolvedValue(makeLlmResponse([concept1])) } },
    }
    const openai2 = {
      chat: { completions: { create: vi.fn().mockResolvedValue(makeLlmResponse([concept2])) } },
    }

    setupDbForGenerate(db1, WARM_TASTE)
    setupDbInsertReturning(
      db1,
      makeInsertedRow({ ...concept1, reasonCodes: concept1.reasonCodes, desiredMediaTypes: concept1.desiredMediaTypes }),
    )

    setupDbForGenerate(db2, WARM_TASTE_2)
    setupDbInsertReturning(
      db2,
      makeInsertedRow({ ...concept2, id: 'c2', profileId: PROFILE_ID_2, reasonCodes: concept2.reasonCodes, desiredMediaTypes: concept2.desiredMediaTypes }),
    )

    const retrieval = makeRetrievalMock(5)
    const svc1 = makeService(db1, openai1, makeEmbeddingProviderMock(), retrieval)
    const svc2 = makeService(db2, openai2, makeEmbeddingProviderMock(), retrieval)

    const [concepts1, concepts2] = await Promise.all([
      svc1.generateConcepts(PROFILE_ID, { count: 1 }),
      svc2.generateConcepts(PROFILE_ID_2, { count: 1 }),
    ])

    expect(concepts1.length).toBeGreaterThan(0)
    expect(concepts2.length).toBeGreaterThan(0)
    expect(concepts1[0].rawIntent).not.toBe(concepts2[0].rawIntent)
    // Verify different top genres are represented in reason codes
    expect(JSON.stringify(concepts1[0].reasonCodes)).toContain('thriller')
    expect(JSON.stringify(concepts2[0].reasonCodes)).toContain('animation')
  })

  it('rejects concepts where dry-run retrieval returns fewer than 3 candidates', async () => {
    const db = makeMockDb()
    const openai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(
            makeLlmResponse([
              {
                title: 'Obscure concept',
                rawIntent: 'Very niche content',
                semanticIntent: 'Extremely niche content that matches nothing in the catalog',
                generationType: 'PERSONALIZED',
                reasonCodes: [],
                desiredMediaTypes: ['MOVIE'],
                freshnessPolicy: null,
              },
            ]),
          ),
        },
      },
    }
    const retrieval = makeRetrievalMock(1) // Only 1 candidate → concept rejected

    setupDbForGenerate(db, WARM_TASTE)

    const svc = makeService(db, openai, makeEmbeddingProviderMock(), retrieval)
    const concepts = await svc.generateConcepts(PROFILE_ID, { count: 1 })
    expect(concepts).toHaveLength(0)
  })

  it('rejects duplicate concepts via cosine similarity above threshold', async () => {
    const db = makeMockDb()
    const twin = {
      title: 'Twin B',
      rawIntent: 'Nearly identical intent',
      semanticIntent: 'Identical semantic space that should trigger dedup',
      generationType: 'PERSONALIZED' as const,
      reasonCodes: [],
      desiredMediaTypes: ['MOVIE'],
      freshnessPolicy: null,
    }
    const openai = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue(makeLlmResponse([{ ...twin, title: 'Twin A' }, twin])),
        },
      },
    }

    // Identical vector for both → similarity = 1.0 → second rejected
    const embeddingProvider = { embed: vi.fn().mockResolvedValue([1, 0, 0, 0]) }
    const retrieval = makeRetrievalMock(5)

    setupDbForGenerate(db, WARM_TASTE)
    // First concept inserted
    setupDbInsertReturning(
      db,
      makeInsertedRow({ ...twin, title: 'Twin A', reasonCodes: [], desiredMediaTypes: ['MOVIE'] }),
    )

    const svc = makeService(db, openai, embeddingProvider, retrieval)
    const concepts = await svc.generateConcepts(PROFILE_ID, { count: 2 })
    // At most 1 concept persisted (second rejected by dedup)
    expect(concepts.length).toBeLessThanOrEqual(1)
  })

  it('throws when no OpenAI key is configured', async () => {
    const svc = makeService(makeMockDb(), null)
    await expect(svc.generateConcepts(PROFILE_ID)).rejects.toThrow('not configured')
  })
})
