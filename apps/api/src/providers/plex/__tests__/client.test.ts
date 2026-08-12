import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PlexClient } from '../client.js'
import { PlexAuthError, PlexNetworkError, PlexParseError } from '../errors.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const TOKEN = 'super-secret-plex-token'
const BASE_URL = 'http://plex.example.com:32400'

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ errors: [{ message: 'error' }] }),
  } as unknown as Response
}

const identityFixture = {
  MediaContainer: {
    size: 0,
    claimed: 1,
    machineIdentifier: 'abc123def456',
    version: '1.32.0.6950',
    friendlyName: 'My Plex Server',
  },
}

const sectionsFixture = {
  MediaContainer: {
    size: 2,
    Directory: [
      { key: '1', title: 'Movies', type: 'movie' },
      { key: '2', title: 'TV Shows', type: 'show' },
      { key: '3', title: 'Music', type: 'artist' },
    ],
  },
}

const moviesFixture = {
  MediaContainer: {
    size: 2,
    totalSize: 2,
    Metadata: [
      {
        ratingKey: '10001',
        title: 'Inception',
        year: 2010,
        thumb: '/library/metadata/10001/thumb/123',
        summary: 'A thief who steals corporate secrets.',
        Guid: [{ id: 'tmdb://27205' }, { id: 'imdb://tt1375666' }],
      },
      {
        ratingKey: '10002',
        title: 'The Matrix',
        year: 1999,
        thumb: '/library/metadata/10002/thumb/456',
        summary: 'A computer hacker learns the truth.',
      },
    ],
  },
}

const showsFixture = {
  MediaContainer: {
    size: 1,
    totalSize: 1,
    Metadata: [
      {
        ratingKey: '20001',
        title: 'Breaking Bad',
        year: 2008,
        thumb: '/library/metadata/20001/thumb/789',
        summary: 'A high school chemistry teacher turned drug manufacturer.',
        Guid: [{ id: 'tmdb://1396' }, { id: 'tvdb://81189' }],
      },
    ],
  },
}

describe('PlexClient', () => {
  let client: PlexClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new PlexClient(BASE_URL, TOKEN, 5000)
  })

  describe('token handling', () => {
    it('sends token as X-Plex-Token header, not in URL', async () => {
      let capturedUrl = ''
      let capturedHeaders: Record<string, string> = {}
      mockFetch.mockImplementationOnce((url: string, init: RequestInit) => {
        capturedUrl = url
        capturedHeaders = init?.headers as Record<string, string>
        return Promise.resolve(okResponse(identityFixture))
      })

      await client.testConnection()

      expect(capturedUrl).not.toContain(TOKEN)
      expect(capturedHeaders['X-Plex-Token']).toBe(TOKEN)
    })

    it('does not include token in PlexAuthError message', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      const err = await client.fetchLibrarySections().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(PlexAuthError)
      expect((err as PlexAuthError).message).not.toContain(TOKEN)
    })

    it('does not include token in PlexNetworkError message', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      const err = await client.fetchLibrarySections().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(PlexNetworkError)
      expect((err as PlexNetworkError).message).not.toContain(TOKEN)
    })
  })

  describe('testConnection()', () => {
    it('returns ok: true with serverName on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(identityFixture))
      const result = await client.testConnection()
      expect(result.ok).toBe(true)
      expect(result.serverName).toBe('My Plex Server')
    })

    it('returns ok: true without serverName when friendlyName is absent', async () => {
      const noName = { MediaContainer: { machineIdentifier: 'abc123' } }
      mockFetch.mockResolvedValueOnce(okResponse(noName))
      const result = await client.testConnection()
      expect(result.ok).toBe(true)
      expect(result.serverName).toBeUndefined()
    })

    it('returns ok: false with message on 401', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      const result = await client.testConnection()
      expect(result.ok).toBe(false)
      expect(typeof result.message).toBe('string')
    })

    it('returns ok: false with message on 403', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403))
      const result = await client.testConnection()
      expect(result.ok).toBe(false)
    })

    it('returns ok: false with message on network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      const result = await client.testConnection()
      expect(result.ok).toBe(false)
      expect(typeof result.message).toBe('string')
    })

    it('returns ok: false on timeout', async () => {
      const timeoutError = new DOMException('The operation was aborted.', 'TimeoutError')
      mockFetch.mockRejectedValueOnce(timeoutError)
      const result = await client.testConnection()
      expect(result.ok).toBe(false)
    })

    it('returns ok: false when MediaContainer is missing', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ unexpected: true }))
      const result = await client.testConnection()
      expect(result.ok).toBe(false)
    })
  })

  describe('fetchLibrarySections()', () => {
    it('returns only movie and show sections, filtering out unsupported types', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(sectionsFixture))
      const sections = await client.fetchLibrarySections()
      expect(sections).toHaveLength(2)
      expect(sections[0]).toEqual({ key: '1', title: 'Movies', type: 'movie' })
      expect(sections[1]).toEqual({ key: '2', title: 'TV Shows', type: 'show' })
    })

    it('returns empty array when no supported sections exist', async () => {
      const fixture = { MediaContainer: { Directory: [{ key: '3', title: 'Music', type: 'artist' }] } }
      mockFetch.mockResolvedValueOnce(okResponse(fixture))
      const sections = await client.fetchLibrarySections()
      expect(sections).toEqual([])
    })

    it('throws PlexParseError when Directory is missing', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ MediaContainer: {} }))
      await expect(client.fetchLibrarySections()).rejects.toBeInstanceOf(PlexParseError)
    })

    it('throws PlexAuthError on 401', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      await expect(client.fetchLibrarySections()).rejects.toBeInstanceOf(PlexAuthError)
    })

    it('throws PlexNetworkError on unreachable host', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      await expect(client.fetchLibrarySections()).rejects.toBeInstanceOf(PlexNetworkError)
    })

    it('throws PlexNetworkError on timeout', async () => {
      const timeoutError = new DOMException('The operation was aborted.', 'TimeoutError')
      mockFetch.mockRejectedValueOnce(timeoutError)
      await expect(client.fetchLibrarySections()).rejects.toBeInstanceOf(PlexNetworkError)
    })
  })

  describe('fetchMovies()', () => {
    it('returns mapped movies with Guid extraction', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(moviesFixture))
      const movies = await client.fetchMovies('1')
      expect(movies).toHaveLength(2)

      const inception = movies[0]
      expect(inception.ratingKey).toBe('10001')
      expect(inception.title).toBe('Inception')
      expect(inception.year).toBe(2010)
      expect(inception.thumb).toBe('/library/metadata/10001/thumb/123')
      expect(inception.summary).toBe('A thief who steals corporate secrets.')
      expect(inception.Guid).toEqual([{ id: 'tmdb://27205' }, { id: 'imdb://tt1375666' }])
    })

    it('returns movie without optional fields when absent', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(moviesFixture))
      const movies = await client.fetchMovies('1')
      const matrix = movies[1]
      expect(matrix.ratingKey).toBe('10002')
      expect(matrix.title).toBe('The Matrix')
      expect(matrix.Guid).toBeUndefined()
    })

    it('passes section key and type=1 in request', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(moviesFixture))
      })
      await client.fetchMovies('42')
      expect(capturedUrl).toContain('/library/sections/42/all')
      expect(capturedUrl).toContain('type=1')
    })

    it('returns empty array when Metadata is absent (empty section)', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ MediaContainer: {} }))
      const movies = await client.fetchMovies('1')
      expect(movies).toEqual([])
    })

    it('throws PlexAuthError on 403', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(403))
      await expect(client.fetchMovies('1')).rejects.toBeInstanceOf(PlexAuthError)
    })
  })

  describe('fetchShows()', () => {
    it('returns mapped shows', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(showsFixture))
      const shows = await client.fetchShows('2')
      expect(shows).toHaveLength(1)
      const bb = shows[0]
      expect(bb.ratingKey).toBe('20001')
      expect(bb.title).toBe('Breaking Bad')
      expect(bb.year).toBe(2008)
      expect(bb.Guid).toEqual([{ id: 'tmdb://1396' }, { id: 'tvdb://81189' }])
    })

    it('passes section key and type=2 in request', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(showsFixture))
      })
      await client.fetchShows('7')
      expect(capturedUrl).toContain('/library/sections/7/all')
      expect(capturedUrl).toContain('type=2')
    })

    it('returns empty array when Metadata is absent', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ MediaContainer: {} }))
      const shows = await client.fetchShows('2')
      expect(shows).toEqual([])
    })
  })

  describe('error class identity', () => {
    it('error classes are distinct', () => {
      const authErr = new PlexAuthError('auth')
      const netErr = new PlexNetworkError('network')
      const parseErr = new PlexParseError('/endpoint')

      expect(authErr).toBeInstanceOf(PlexAuthError)
      expect(authErr).not.toBeInstanceOf(PlexNetworkError)
      expect(authErr).not.toBeInstanceOf(PlexParseError)

      expect(netErr).toBeInstanceOf(PlexNetworkError)
      expect(netErr).not.toBeInstanceOf(PlexAuthError)

      expect(parseErr).toBeInstanceOf(PlexParseError)
      expect(parseErr).not.toBeInstanceOf(PlexAuthError)
    })
  })
})
