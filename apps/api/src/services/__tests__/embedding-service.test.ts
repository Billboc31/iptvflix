import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { EmbeddingProvider } from '../embedding-provider.js'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { EmbeddingService } from '../embedding-service.js'

const MOVIE_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const SERIES_ID = 'bbbbbbbb-0000-0000-0000-000000000001'
const MOCK_VECTOR = Array.from({ length: 1536 }, (_, i) => i / 1536)

const mockProvider: EmbeddingProvider = {
  modelProvider: 'mock',
  modelName: 'mock-v1',
  dimension: 1536,
  embed: vi.fn().mockResolvedValue(MOCK_VECTOR),
  embedBatch: vi.fn().mockResolvedValue([MOCK_VECTOR]),
}

// Build a select().from().where() chain resolving to `rows`
function simpleSelectChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows)
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

// Build a select().from().innerJoin().where() chain resolving to `rows`
function joinSelectChain(rows: unknown[]) {
  const where = vi.fn().mockResolvedValue(rows)
  const innerJoin = vi.fn().mockReturnValue({ where })
  const from = vi.fn().mockReturnValue({ where, innerJoin })
  return { from }
}

// Build a select().from().where().orderBy().limit() chain
function searchSelectChain(rows: unknown[]) {
  const limit = vi.fn().mockResolvedValue(rows)
  const orderBy = vi.fn().mockReturnValue({ limit })
  const where = vi.fn().mockReturnValue({ orderBy })
  const from = vi.fn().mockReturnValue({ where })
  return { from }
}

const MOVIE_ROW = [{
  id: MOVIE_ID,
  title: 'Arrival',
  originalTitle: 'Arrival',
  year: 2016,
  synopsis: 'A linguist talks to aliens.',
  keywords: ['first contact'],
  originalLanguage: 'en',
  durationMinutes: 116,
  voteAverage: 7.9,
  popularity: 42,
  certification: null,
  collectionId: null,
}]

describe('EmbeddingService.upsertEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls provider.embed and inserts when no existing row', async () => {
    // buildDocumentForMedia calls:
    // 1) select movie row: select().from().where()
    // 2) Promise.all([genres, credits, collection]):
    //    - genres: select().from().innerJoin().where()  OR select().from().where()
    //    - credits: select().from().where()
    //    - collection: skipped (collectionId is null → resolves [])
    // 3) select existing embedding: select().from().where()

    mockDb.select
      // 1. movie row
      .mockReturnValueOnce(simpleSelectChain(MOVIE_ROW))
      // 2a. genres (innerJoin path)
      .mockReturnValueOnce(joinSelectChain([{ name: 'SF' }]))
      // 2b. credits
      .mockReturnValueOnce(simpleSelectChain([{ role: 'director', name: 'Denis Villeneuve', creditOrder: 0 }]))
      // 3. existing embedding (none)
      .mockReturnValueOnce(simpleSelectChain([]))

    const onConflict = vi.fn().mockResolvedValue([])
    const values = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflict })
    mockDb.insert.mockReturnValue({ values })

    const service = new EmbeddingService(mockDb as any, mockProvider)
    const result = await service.upsertEmbedding(MOVIE_ID, 'MOVIE')

    expect(mockProvider.embed).toHaveBeenCalledOnce()
    expect(mockDb.insert).toHaveBeenCalledOnce()
    expect(result.action).toBe('embedded')
    expect(result.mediaId).toBe(MOVIE_ID)
  })

  it('skips embedding when doc_hash is unchanged', async () => {
    const { buildMovieEmbeddingDocument, hashDocument } = await import('../embedding-document-builder.js')
    const doc = buildMovieEmbeddingDocument(
      {
        title: 'Arrival',
        year: 2016,
        synopsis: 'A linguist talks to aliens.',
        keywords: ['first contact'],
        originalLanguage: 'en',
        durationMinutes: 116,
        voteAverage: 7.9,
        popularity: 42,
        certification: null,
        collectionName: null,
      },
      [{ name: 'SF' }],
      [{ role: 'director', name: 'Denis Villeneuve', creditOrder: 0 }],
    )
    const expectedHash = hashDocument(doc)

    mockDb.select
      .mockReturnValueOnce(simpleSelectChain(MOVIE_ROW))
      .mockReturnValueOnce(joinSelectChain([{ name: 'SF' }]))
      .mockReturnValueOnce(simpleSelectChain([{ role: 'director', name: 'Denis Villeneuve', creditOrder: 0 }]))
      // existing embedding with matching hash
      .mockReturnValueOnce(simpleSelectChain([{ id: 'existing-id', docHash: expectedHash }]))

    const service = new EmbeddingService(mockDb as any, mockProvider)
    const result = await service.upsertEmbedding(MOVIE_ID, 'MOVIE')

    expect(mockProvider.embed).not.toHaveBeenCalled()
    expect(mockDb.insert).not.toHaveBeenCalled()
    expect(result.action).toBe('skipped')
  })
})

describe('EmbeddingService.semanticSearch', () => {
  it('embeds query text and returns ordered results by distance', async () => {
    const rows = [
      { mediaId: MOVIE_ID, mediaType: 'MOVIE', modelProvider: 'mock', modelName: 'mock-v1', docHash: 'h1', generatedAt: new Date(), distance: 0.1 },
      { mediaId: SERIES_ID, mediaType: 'SERIES', modelProvider: 'mock', modelName: 'mock-v1', docHash: 'h2', generatedAt: new Date(), distance: 0.3 },
    ]

    mockDb.select.mockReturnValue(searchSelectChain(rows))

    const service = new EmbeddingService(mockDb as any, mockProvider)
    const results = await service.semanticSearch('SF cérébrale', 5)

    expect(mockProvider.embed).toHaveBeenCalledWith('SF cérébrale')
    expect(results).toHaveLength(2)
    // cosine similarity = 1 - distance, so 0.9 > 0.7
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity)
    expect(results[0].rank).toBe(1)
    expect(results[1].rank).toBe(2)
  })
})
