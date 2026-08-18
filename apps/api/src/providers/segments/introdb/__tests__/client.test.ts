import { describe, it, expect, vi, beforeEach } from 'vitest'
import { IntroDbClient } from '../client.js'
import { IntroDbRateLimitError, IntroDbNetworkError } from '../errors.js'

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
  return { ok: false, status: 404, headers: { get: () => null }, json: () => Promise.resolve({}) } as unknown as Response
}

function rateLimitResponse(retryAfter = 0): Response {
  return {
    ok: false,
    status: 429,
    headers: { get: (n: string) => (n === 'Retry-After' ? String(retryAfter) : null) },
    json: () => Promise.resolve({}),
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return { ok: false, status, headers: { get: () => null }, json: () => Promise.resolve({}) } as unknown as Response
}

const SEGMENT_FIXTURE = {
  intro: { start: 60, end: 120 },
  recap: { start: 0, end: 30 },
  outro: { start: 1400, end: 1440 },
  confidence: 0.95,
  submissionCount: 42,
}

describe('IntroDbClient', () => {
  let client: IntroDbClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new IntroDbClient({ baseUrl: 'https://api.introdb.test', timeoutMs: 5000 })
  })

  describe('fetchRaw()', () => {
    it('returns parsed segment data on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      const result = await client.fetchRaw('tt0816692', 1, 1)
      expect(result).not.toBeNull()
      expect(result!.intro).toEqual({ start: 60, end: 120 })
      expect(result!.recap).toEqual({ start: 0, end: 30 })
      expect(result!.outro).toEqual({ start: 1400, end: 1440 })
      expect(result!.confidence).toBe(0.95)
      expect(result!.submissionCount).toBe(42)
    })

    it('includes imdb_id, season, episode in the request URL', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      await client.fetchRaw('tt0816692', 3, 7)
      const url = mockFetch.mock.calls[0][0] as string
      expect(url).toContain('imdb_id=tt0816692')
      expect(url).toContain('season=3')
      expect(url).toContain('episode=7')
    })

    it('returns null on 404 (no data — not an error)', async () => {
      mockFetch.mockResolvedValueOnce(notFoundResponse())
      const result = await client.fetchRaw('tt9999999', 1, 1)
      expect(result).toBeNull()
    })

    it('throws IntroDbNetworkError on non-2xx non-404 non-429', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(500))
      await expect(client.fetchRaw('tt0000001', 1, 1)).rejects.toThrow(IntroDbNetworkError)
    })

    it('retries on 429 and succeeds on second attempt', async () => {
      mockFetch
        .mockResolvedValueOnce(rateLimitResponse(0))
        .mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      const result = await client.fetchRaw('tt0816692', 1, 1)
      expect(result).not.toBeNull()
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('throws IntroDbRateLimitError after max retries exceeded', async () => {
      mockFetch.mockResolvedValue(rateLimitResponse(0))
      await expect(client.fetchRaw('tt0816692', 1, 1)).rejects.toThrow(IntroDbRateLimitError)
    })
  })

  describe('fetchEpisodeSegments()', () => {
    it('returns empty array when seriesImdbId is null', async () => {
      const result = await client.fetchEpisodeSegments({
        episodeId: 'ep-1',
        seriesImdbId: null,
        seasonNumber: 1,
        episodeNumber: 1,
      })
      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns mapped RawSegment array on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(SEGMENT_FIXTURE))
      const result = await client.fetchEpisodeSegments({
        episodeId: 'ep-1',
        seriesImdbId: 'tt0816692',
        seasonNumber: 1,
        episodeNumber: 5,
      })
      expect(result).toHaveLength(3)
      const types = result.map((s) => s.type)
      expect(types).toContain('INTRO')
      expect(types).toContain('RECAP')
      expect(types).toContain('OUTRO')
    })

    it('returns empty array on 404', async () => {
      mockFetch.mockResolvedValueOnce(notFoundResponse())
      const result = await client.fetchEpisodeSegments({
        episodeId: 'ep-99',
        seriesImdbId: 'tt9999999',
        seasonNumber: 1,
        episodeNumber: 1,
      })
      expect(result).toEqual([])
    })
  })
})
