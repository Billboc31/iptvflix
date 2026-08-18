import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TheIntroDbClient } from '../client.js'
import { TheIntroDbRateLimitError, TheIntroDbNetworkError } from '../errors.js'
import type { CanonicalEpisodeRef } from '../../types.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeHeaders(overrides: Record<string, string> = {}): { get: (name: string) => string | null } {
  return { get: (name: string) => overrides[name] ?? null }
}

function okResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return {
    ok: true,
    status: 200,
    headers: makeHeaders(headers),
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function notFoundResponse(): Response {
  return { ok: false, status: 404, headers: makeHeaders(), json: () => Promise.resolve({}) } as unknown as Response
}

function rateLimitResponse(headers: Record<string, string> = {}): Response {
  return {
    ok: false,
    status: 429,
    headers: makeHeaders(headers),
    json: () => Promise.resolve({}),
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return { ok: false, status, headers: makeHeaders(), json: () => Promise.resolve({}) } as unknown as Response
}

const SEGMENT_FIXTURE = {
  intro: [{ start: 60, end: 120, submissions: 10 }],
  credits: [{ start: 1380, end: 1440, submissions: 5 }],
}

const EPISODE_WITH_TMDB: CanonicalEpisodeRef = {
  episodeId: 'ep-1',
  seriesImdbId: 'tt0816692',
  seriesTmdbId: 1399,
  seasonNumber: 1,
  episodeNumber: 1,
}

const EPISODE_WITH_IMDB_ONLY: CanonicalEpisodeRef = {
  episodeId: 'ep-2',
  seriesImdbId: 'tt0816692',
  seriesTmdbId: null,
  seasonNumber: 2,
  episodeNumber: 3,
}

const EPISODE_NO_IDS: CanonicalEpisodeRef = {
  episodeId: 'ep-3',
  seriesImdbId: null,
  seriesTmdbId: null,
  seasonNumber: 1,
  episodeNumber: 1,
}

describe('TheIntroDbClient', () => {
  let client: TheIntroDbClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new TheIntroDbClient({ baseUrl: 'https://api.theintrodb.test', timeoutMs: 5000 })
  })

  describe('fetchEpisodeSegments()', () => {
    it('returns empty array when both seriesTmdbId and seriesImdbId are null', async () => {
      const result = await client.fetchEpisodeSegments(EPISODE_NO_IDS)
      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('uses TMDB path (tmdb_id param) when seriesTmdbId is available', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      await client.fetchEpisodeSegments(EPISODE_WITH_TMDB)
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('tmdb_id=1399')
      expect(url).not.toContain('imdb_id=')
      expect(url).toContain('season=1')
      expect(url).toContain('episode=1')
    })

    it('falls back to IMDb path (imdb_id param) when seriesTmdbId is null', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      await client.fetchEpisodeSegments(EPISODE_WITH_IMDB_ONLY)
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('imdb_id=tt0816692')
      expect(url).not.toContain('tmdb_id=')
    })

    it('returns mapped RawSegments on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      const result = await client.fetchEpisodeSegments(EPISODE_WITH_TMDB)
      expect(result).toHaveLength(2)
      const types = result.map((s) => s.type)
      expect(types).toContain('INTRO')
      expect(types).toContain('CREDITS')
    })

    it('returns empty array on 404', async () => {
      mockFetch.mockResolvedValueOnce(notFoundResponse())
      const result = await client.fetchEpisodeSegments(EPISODE_WITH_TMDB)
      expect(result).toEqual([])
    })

    it('throws TheIntroDbNetworkError on non-2xx non-404 non-429', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500))
      await expect(client.fetchEpisodeSegments(EPISODE_WITH_TMDB)).rejects.toThrow(TheIntroDbNetworkError)
    })

    it('retries on 429 using X-RateLimit-Reset header and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse({ 'X-RateLimit-Reset': '0' }))
        .mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      const result = await client.fetchEpisodeSegments(EPISODE_WITH_TMDB)
      expect(result).not.toHaveLength(0)
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws TheIntroDbRateLimitError after max retries on 429', async () => {
      mockFetch.mockResolvedValue(rateLimitResponse({ 'X-RateLimit-Reset': '0' }))
      await expect(client.fetchEpisodeSegments(EPISODE_WITH_TMDB)).rejects.toThrow(TheIntroDbRateLimitError)
    })

    it('throws TheIntroDbNetworkError on fetch timeout', async () => {
      const timeoutError = new DOMException('The operation was aborted', 'TimeoutError')
      mockFetch.mockRejectedValueOnce(timeoutError)
      await expect(client.fetchEpisodeSegments(EPISODE_WITH_TMDB)).rejects.toThrow(TheIntroDbNetworkError)
    })

    it('warns when X-RateLimit-Remaining drops below threshold', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const clientWithLowThreshold = new TheIntroDbClient({
        baseUrl: 'https://api.theintrodb.test',
        rateLimitWarnThreshold: 20,
      })
      mockFetch.mockResolvedValueOnce(
        okResponse(SEGMENT_FIXTURE, { 'X-RateLimit-Remaining': '5' }),
      )
      await clientWithLowThreshold.fetchEpisodeSegments(EPISODE_WITH_TMDB)
      expect(warnSpy).toHaveBeenCalled()
      const warnArg: string = warnSpy.mock.calls[0][0] as string
      expect(warnArg).toContain('theintrodb_rate_limit_low')
      warnSpy.mockRestore()
    })

    it('skips unknown segment keys returned by the API', async () => {
      const responseWithUnknown = {
        intro: [{ start: 60, end: 120, submissions: 5 }],
        unknownKey: [{ start: 200, end: 300 }],
      }
      mockFetch.mockResolvedValueOnce(okResponse(responseWithUnknown))
      const result = await client.fetchEpisodeSegments(EPISODE_WITH_TMDB)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('INTRO')
    })
  })
})
