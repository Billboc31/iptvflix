import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { XtreamCodesClient } from '../client.js'
import { XtreamAuthError, XtreamNetworkError, XtreamParseError } from '../errors.js'

const require = createRequire(import.meta.url)
const accountInfoFixture = require('./fixtures/account-info.json')
const vodCategoriesFixture = require('./fixtures/vod-categories.json')
const vodStreamsFixture = require('./fixtures/vod-streams.json')
const seriesCategoriesFixture = require('./fixtures/series-categories.json')
const seriesListFixture = require('./fixtures/series-list.json')
const seriesInfoFixture = require('./fixtures/series-info.json')
const largeVodStreamsFixture = require('./fixtures/large-vod-streams.json')

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

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
    json: () => Promise.resolve({ message: 'error' }),
  } as unknown as Response
}

const CLIENT_CONFIG = {
  baseUrl: 'http://xtream.example.com',
  username: 'testuser',
  password: 'testpass',
  timeoutMs: 5000,
}

describe('XtreamCodesClient', () => {
  let client: XtreamCodesClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new XtreamCodesClient(CLIENT_CONFIG)
  })

  describe('authenticate()', () => {
    it('returns XtreamUserInfo on success', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(accountInfoFixture))
      const info = await client.authenticate()
      expect(info.username).toBe('testuser')
      expect(info.status).toBe('Active')
      expect(info.max_connections).toBe('1')
      expect(Array.isArray(info.allowed_output_formats)).toBe(true)
    })

    it('throws XtreamAuthError when account is Disabled', async () => {
      const disabledResponse = {
        ...accountInfoFixture,
        user_info: { ...accountInfoFixture.user_info, status: 'Disabled' },
      }
      mockFetch.mockResolvedValueOnce(okResponse(disabledResponse))
      await expect(client.authenticate()).rejects.toBeInstanceOf(XtreamAuthError)
    })

    it('throws XtreamAuthError on HTTP 401', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      await expect(client.authenticate()).rejects.toBeInstanceOf(XtreamAuthError)
    })

    it('does not include credentials in XtreamAuthError message', async () => {
      mockFetch.mockResolvedValueOnce(errorResponse(401))
      const err = await client.authenticate().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(XtreamAuthError)
      expect((err as XtreamAuthError).message).not.toContain('testpass')
      expect((err as XtreamAuthError).message).not.toContain('testuser')
    })
  })

  describe('getVodCategories()', () => {
    it('returns array of XtreamCategory', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(vodCategoriesFixture))
      const categories = await client.getVodCategories()
      expect(categories).toHaveLength(5)
      expect(categories[0]).toMatchObject({
        category_id: '1',
        category_name: 'Action',
        parent_id: 0,
      })
    })

    it('returns empty array for empty catalog', async () => {
      mockFetch.mockResolvedValueOnce(okResponse([]))
      const categories = await client.getVodCategories()
      expect(categories).toEqual([])
    })
  })

  describe('getVodStreams()', () => {
    it('returns array of XtreamVodStream', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(vodStreamsFixture))
      const streams = await client.getVodStreams()
      expect(streams).toHaveLength(3)
      expect(streams[0]).toMatchObject({
        name: 'The Matrix',
        stream_id: 1001,
        category_id: '4',
        container_extension: 'mkv',
      })
    })

    it('forwards category_id query param when provided', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(vodStreamsFixture))
      })
      await client.getVodStreams('42')
      expect(capturedUrl).toContain('category_id=42')
      expect(capturedUrl).toContain('action=get_vod_streams')
    })

    it('does not forward category_id when not provided', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(vodStreamsFixture))
      })
      await client.getVodStreams()
      expect(capturedUrl).not.toContain('category_id')
    })
  })

  describe('getSeriesCategories()', () => {
    it('returns array of XtreamCategory', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(seriesCategoriesFixture))
      const categories = await client.getSeriesCategories()
      expect(categories).toHaveLength(3)
      expect(categories[0].category_name).toBe('Drama Series')
    })
  })

  describe('getSeries()', () => {
    it('returns array of XtreamSeries', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(seriesListFixture))
      const series = await client.getSeries()
      expect(series).toHaveLength(2)
      expect(series[0]).toMatchObject({
        series_id: 201,
        name: 'Breaking Bad',
        category_id: '10',
      })
    })

    it('forwards category_id query param when provided', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(seriesListFixture))
      })
      await client.getSeries('10')
      expect(capturedUrl).toContain('category_id=10')
      expect(capturedUrl).toContain('action=get_series')
    })
  })

  describe('getSeriesInfo()', () => {
    it('returns XtreamSeriesInfo with info and episodes map', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(seriesInfoFixture))
      const info = await client.getSeriesInfo(201)
      expect(info.info.name).toBe('Breaking Bad')
      expect(info.episodes['1']).toHaveLength(2)
      expect(info.episodes['1'][0].title).toBe('Pilot')
      expect(info.episodes['2']).toHaveLength(1)
    })

    it('forwards series_id query param', async () => {
      let capturedUrl = ''
      mockFetch.mockImplementationOnce((url: string) => {
        capturedUrl = url
        return Promise.resolve(okResponse(seriesInfoFixture))
      })
      await client.getSeriesInfo(201)
      expect(capturedUrl).toContain('series_id=201')
    })
  })

  describe('error handling', () => {
    it('throws XtreamParseError on malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as unknown as Response)
      await expect(client.getVodCategories()).rejects.toBeInstanceOf(XtreamParseError)
    })

    it('XtreamParseError message does not contain credentials', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token')),
      } as unknown as Response)
      const err = await client.getVodCategories().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(XtreamParseError)
      expect((err as XtreamParseError).message).not.toContain('testpass')
    })

    it('throws XtreamParseError when array endpoint returns non-array', async () => {
      mockFetch.mockResolvedValueOnce(okResponse({ error: 'unexpected object' }))
      await expect(client.getVodCategories()).rejects.toBeInstanceOf(XtreamParseError)
    })

    it('throws XtreamNetworkError on timeout (DOMException TimeoutError)', async () => {
      const timeoutError = new DOMException('The operation was aborted.', 'TimeoutError')
      mockFetch.mockRejectedValueOnce(timeoutError)
      await expect(client.getVodStreams()).rejects.toBeInstanceOf(XtreamNetworkError)
    })

    it('throws XtreamNetworkError on unreachable host (TypeError)', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      await expect(client.getVodStreams()).rejects.toBeInstanceOf(XtreamNetworkError)
    })

    it('XtreamNetworkError message does not contain credentials', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      const err = await client.getVodStreams().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(XtreamNetworkError)
      expect((err as XtreamNetworkError).message).not.toContain('testpass')
      expect((err as XtreamNetworkError).message).not.toContain('testuser')
    })

    it('error classes are distinct (instanceof checks)', async () => {
      const authErr = new XtreamAuthError('auth failed')
      const netErr = new XtreamNetworkError('network failed')
      const parseErr = new XtreamParseError('some_endpoint')

      expect(authErr).toBeInstanceOf(XtreamAuthError)
      expect(authErr).not.toBeInstanceOf(XtreamNetworkError)
      expect(authErr).not.toBeInstanceOf(XtreamParseError)

      expect(netErr).toBeInstanceOf(XtreamNetworkError)
      expect(netErr).not.toBeInstanceOf(XtreamAuthError)
      expect(netErr).not.toBeInstanceOf(XtreamParseError)

      expect(parseErr).toBeInstanceOf(XtreamParseError)
      expect(parseErr).not.toBeInstanceOf(XtreamAuthError)
      expect(parseErr).not.toBeInstanceOf(XtreamNetworkError)
    })
  })

  describe('large catalog', () => {
    it('handles 5000-item VOD catalog without crash', async () => {
      mockFetch.mockResolvedValueOnce(okResponse(largeVodStreamsFixture))
      const streams = await client.getVodStreams()
      expect(streams).toHaveLength(5000)
      expect(streams[0].name).toBe('Movie 1')
      expect(streams[4999].name).toBe('Movie 5000')
    })
  })
})
