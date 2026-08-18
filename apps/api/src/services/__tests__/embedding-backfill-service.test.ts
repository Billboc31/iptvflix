import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
}))

vi.mock('../../db/client.js', () => ({ db: mockDb }))

import { runBackfill } from '../embedding-backfill-service.js'
import type { EmbeddingService } from '../embedding-service.js'

const MOVIE_ID_1 = 'aaaaaaaa-0000-0000-0000-000000000001'
const MOVIE_ID_2 = 'aaaaaaaa-0000-0000-0000-000000000002'
const NOW = new Date('2024-01-01T00:00:00Z')

function makeSelectChain(pages: { id: string; createdAt: Date }[][]): void {
  let callCount = 0
  mockDb.select.mockImplementation(() => {
    const rows = pages[callCount] ?? []
    callCount++
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }
  })
}

describe('runBackfill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('processes all items and reports correct counters', async () => {
    const movies = [
      { id: MOVIE_ID_1, createdAt: NOW },
      { id: MOVIE_ID_2, createdAt: NOW },
    ]
    const series: never[] = []

    // movies: first page returns 2 items, second page empty (done)
    // series: first page empty
    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      const page = selectCall++
      // page 0: movies first batch (2 items)
      // page 1: movies second batch (empty — signals done)
      // page 2: series first batch (empty)
      const rows = page === 0 ? movies : []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      }
    })

    const mockEmbeddingService = {
      upsertEmbedding: vi.fn().mockResolvedValue({ action: 'embedded', mediaId: MOVIE_ID_1, mediaType: 'MOVIE' }),
    } as unknown as EmbeddingService

    const result = await runBackfill(mockDb as any, mockEmbeddingService, { batchSize: 50, concurrency: 2 })

    expect(result.movies.embedded).toBe(2)
    expect(result.movies.skipped).toBe(0)
    expect(result.movies.failed).toBe(0)
    expect(result.series.processed).toBe(0)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('is idempotent — second run skips all items with unchanged hashes', async () => {
    const movies = [{ id: MOVIE_ID_1, createdAt: NOW }]

    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      const page = selectCall++
      const rows = page === 0 ? movies : []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      }
    })

    const mockEmbeddingService = {
      upsertEmbedding: vi.fn().mockResolvedValue({ action: 'skipped', mediaId: MOVIE_ID_1, mediaType: 'MOVIE' }),
    } as unknown as EmbeddingService

    const result = await runBackfill(mockDb as any, mockEmbeddingService, { batchSize: 50 })

    expect(result.movies.skipped).toBe(1)
    expect(result.movies.embedded).toBe(0)
    expect(mockEmbeddingService.upsertEmbedding).toHaveBeenCalledOnce()
  })

  it('retries on transient provider error and marks failed after max retries', async () => {
    const movies = [{ id: MOVIE_ID_1, createdAt: NOW }]

    let selectCall = 0
    mockDb.select.mockImplementation(() => {
      const page = selectCall++
      const rows = page === 0 ? movies : []
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(rows),
            }),
          }),
        }),
      }
    })

    const mockEmbeddingService = {
      upsertEmbedding: vi.fn().mockRejectedValue(new Error('rate limit')),
    } as unknown as EmbeddingService

    const result = await runBackfill(mockDb as any, mockEmbeddingService, {
      batchSize: 50,
      maxRetries: 2,
    })

    expect(result.movies.failed).toBe(1)
    // Should have been called maxRetries times
    expect(mockEmbeddingService.upsertEmbedding).toHaveBeenCalledTimes(2)
  })
})
