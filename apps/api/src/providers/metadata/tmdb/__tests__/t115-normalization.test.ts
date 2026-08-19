import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TmdbClient } from '../client.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: () => Promise.resolve(body),
  } as unknown as Response
}

const CLIENT_CONFIG = { apiKey: 'test-api-key', timeoutMs: 5000 }

describe('TmdbClient — T115 normalization', () => {
  let client: TmdbClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new TmdbClient(CLIENT_CONFIG)
  })

  describe('mapMovieDetail()', () => {
    it('maps runtime=0 to runtimeMinutes=null', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          id: 1,
          title: 'Test',
          original_title: 'Test',
          release_date: '2020-01-01',
          overview: 'A movie.',
          genres: [],
          runtime: 0,
          imdb_id: 'tt1234567',
          popularity: 1,
          vote_average: 5,
        }),
      )
      const result = await client.getMovieMetadata(1)
      expect(result).not.toBeNull()
      expect(result!.runtimeMinutes).toBeNull()
    })

    it('maps empty-string imdb_id to imdbId=null', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          id: 2,
          title: 'Test',
          original_title: 'Test',
          release_date: '2020-01-01',
          overview: 'A movie.',
          genres: [],
          runtime: 90,
          imdb_id: '',
          popularity: 1,
          vote_average: 5,
        }),
      )
      const result = await client.getMovieMetadata(2)
      expect(result).not.toBeNull()
      expect(result!.imdbId).toBeNull()
    })

    it('maps blank/whitespace overview to synopsis=null', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          id: 3,
          title: 'Test',
          original_title: 'Test',
          release_date: '2020-01-01',
          overview: '   ',
          genres: [],
          runtime: 90,
          imdb_id: 'tt0000001',
          popularity: 1,
          vote_average: 5,
        }),
      )
      const result = await client.getMovieMetadata(3)
      expect(result).not.toBeNull()
      expect(result!.synopsis).toBeNull()
    })
  })

  describe('mapSeriesDetail()', () => {
    it('maps blank/whitespace overview to synopsis=null', async () => {
      mockFetch.mockResolvedValueOnce(
        okResponse({
          id: 10,
          name: 'Test Series',
          original_name: 'Test Series',
          first_air_date: '2020-01-01',
          overview: '  ',
          genres: [],
          popularity: 1,
          vote_average: 5,
          status: 'Ended',
        }),
      )
      const result = await client.getSeriesMetadata(10)
      expect(result).not.toBeNull()
      expect(result!.synopsis).toBeNull()
    })
  })
})
