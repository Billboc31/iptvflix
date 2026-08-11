import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { TmdbClient } from '../client.js'
import { TmdbRateLimitError, TmdbNetworkError } from '../errors.js'

const require = createRequire(import.meta.url)
const movieDetailFixture = require('./fixtures/movie-detail.json')
const seriesDetailFixture = require('./fixtures/series-detail.json')
const notFoundFixture = require('./fixtures/not-found.json')
const rateLimitedFixture = require('./fixtures/rate-limited.json')

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

function notFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    headers: { get: () => null },
    json: () => Promise.resolve(notFoundFixture),
  } as unknown as Response
}

function rateLimitResponse(retryAfterSeconds = 0): Response {
  return {
    ok: false,
    status: 429,
    headers: { get: (name: string) => (name === 'Retry-After' ? String(retryAfterSeconds) : null) },
    json: () => Promise.resolve(rateLimitedFixture),
  } as unknown as Response
}

const CLIENT_CONFIG = { apiKey: 'test-api-key', timeoutMs: 5000 }

describe('TmdbClient', () => {
  let client: TmdbClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new TmdbClient(CLIENT_CONFIG)
  })

  describe('getMovieMetadata()', () => {
    it('returns mapped ExternalMovieMetadata on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(movieDetailFixture))
      const result = await client.getMovieMetadata(603)
      expect(result).not.toBeNull()
      expect(result!.title).toBe('The Matrix')
      expect(result!.originalTitle).toBe('The Matrix')
      expect(result!.year).toBe(1999)
      expect(result!.runtimeMinutes).toBe(136)
      expect(result!.imdbId).toBe('tt0133093')
      expect(result!.genres).toEqual(['Action', 'Science Fiction'])
      expect(result!.popularity).toBe(64.5)
      expect(result!.voteAverage).toBe(8.2)
    })

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValueOnce(notFoundResponse())
      const result = await client.getMovieMetadata(999999)
      expect(result).toBeNull()
    })

    it('sends Authorization header with Bearer token', async () => {
      let capturedHeaders: Record<string, string> = {}
      mockFetch.mockImplementationOnce((_url: string, init: RequestInit) => {
        capturedHeaders = init.headers as Record<string, string>
        return Promise.resolve(okResponse(movieDetailFixture))
      })
      await client.getMovieMetadata(603)
      expect(capturedHeaders['Authorization']).toBe('Bearer test-api-key')
    })

    it('calls /movie/{id} endpoint', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(movieDetailFixture))
      })
      await client.getMovieMetadata(603)
      expect(capturedUrl).toContain('/movie/603')
    })

    it('throws TmdbNetworkError on malformed JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as unknown as Response)
      await expect(client.getMovieMetadata(603)).rejects.toBeInstanceOf(TmdbNetworkError)
    })

    it('throws TmdbNetworkError on network failure', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      await expect(client.getMovieMetadata(603)).rejects.toBeInstanceOf(TmdbNetworkError)
    })

    it('throws TmdbNetworkError on timeout', async () => {
      mockFetch.mockRejectedValueOnce(new DOMException('Aborted', 'TimeoutError'))
      await expect(client.getMovieMetadata(603)).rejects.toBeInstanceOf(TmdbNetworkError)
    })
  })

  describe('getSeriesMetadata()', () => {
    it('returns mapped ExternalSeriesMetadata on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(seriesDetailFixture))
      const result = await client.getSeriesMetadata(1396)
      expect(result).not.toBeNull()
      expect(result!.title).toBe('Breaking Bad')
      expect(result!.originalTitle).toBe('Breaking Bad')
      expect(result!.firstAirYear).toBe(2008)
      expect(result!.genres).toEqual(['Drama', 'Crime'])
      expect(result!.imdbId).toBeNull()
      expect(result!.popularity).toBe(93.2)
      expect(result!.voteAverage).toBe(9.5)
    })

    it('returns null on 404', async () => {
      mockFetch.mockResolvedValueOnce(notFoundResponse())
      const result = await client.getSeriesMetadata(999999)
      expect(result).toBeNull()
    })

    it('calls /tv/{id} endpoint', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(seriesDetailFixture))
      })
      await client.getSeriesMetadata(1396)
      expect(capturedUrl).toContain('/tv/1396')
    })
  })

  describe('rate limiting', () => {
    it('retries once on 429 and succeeds', async () => {
      mockFetch.mockResolvedValueOnce(rateLimitResponse(0))
      mockFetch.mockResolvedValueOnce(okResponse(movieDetailFixture))
      const result = await client.getMovieMetadata(603)
      expect(result).not.toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws TmdbRateLimitError when second attempt also returns 429', async () => {
      mockFetch.mockResolvedValueOnce(rateLimitResponse(0))
      mockFetch.mockResolvedValueOnce(rateLimitResponse(0))
      await expect(client.getMovieMetadata(603)).rejects.toBeInstanceOf(TmdbRateLimitError)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  describe('error class identity', () => {
    it('TmdbRateLimitError and TmdbNetworkError are distinct', () => {
      const rateErr = new TmdbRateLimitError()
      const netErr = new TmdbNetworkError('fail')
      expect(rateErr).toBeInstanceOf(TmdbRateLimitError)
      expect(rateErr).not.toBeInstanceOf(TmdbNetworkError)
      expect(netErr).toBeInstanceOf(TmdbNetworkError)
      expect(netErr).not.toBeInstanceOf(TmdbRateLimitError)
    })

    it('error messages do not contain the API key', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      const err = await client.getMovieMetadata(603).catch((e: unknown) => e)
      expect(err).toBeInstanceOf(TmdbNetworkError)
      expect((err as TmdbNetworkError).message).not.toContain('test-api-key')
    })
  })
})
