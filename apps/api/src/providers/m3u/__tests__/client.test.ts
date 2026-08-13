import { describe, it, expect, vi, beforeEach } from 'vitest'
import { M3UClient } from '../client.js'
import { M3UAuthError, M3UNetworkError, M3UParseError } from '../errors.js'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const VALID_PLAYLIST = `#EXTM3U
#EXTINF:-1 tvg-name="The Matrix" group-title="VOD Movies",The Matrix
http://stream.example.com/vod/matrix.mkv
#EXTINF:-1 tvg-name="Interstellar" group-title="VOD Movies",Interstellar
http://stream.example.com/vod/interstellar.mkv
#EXTINF:-1 tvg-name="Breaking Bad S01E01" group-title="TV Series",Breaking Bad S01E01
http://stream.example.com/series/bb-s01e01.mkv
#EXTINF:-1 tvg-name="Breaking Bad S01E02" group-title="TV Series",Breaking Bad S01E02
http://stream.example.com/series/bb-s01e02.mkv
`

const NON_M3U_BODY = '<html><body>Not a playlist</body></html>'

function okResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    text: () => Promise.resolve(''),
  } as unknown as Response
}

const BASE_CONFIG = {
  playlistUrl: 'http://iptv.example.com/playlist.m3u',
  timeoutMs: 5000,
}

const CRED_CONFIG = {
  playlistUrl: 'http://iptv.example.com/get.php?username={username}&password={password}&type=m3u_plus',
  username: 'secret_user',
  password: 'secret_pass',
  timeoutMs: 5000,
}

describe('M3UClient.testConnection()', () => {
  let client: M3UClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new M3UClient(BASE_CONFIG)
  })

  it('returns ok: true when playlist starts with #EXTM3U', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(VALID_PLAYLIST))
    const result = await client.testConnection()
    expect(result.ok).toBe(true)
  })

  it('returns ok: false when body is not a valid M3U playlist', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(NON_M3U_BODY))
    const result = await client.testConnection()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('valid M3U')
  })

  it('returns ok: false on HTTP 401', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401))
    const result = await client.testConnection()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('401')
  })

  it('returns ok: false on HTTP 403', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(403))
    const result = await client.testConnection()
    expect(result.ok).toBe(false)
  })

  it('returns ok: false on network timeout', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'TimeoutError'))
    const result = await client.testConnection()
    expect(result.ok).toBe(false)
    expect(result.message).toContain('timed out')
  })

  it('returns ok: false on unreachable host', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    const result = await client.testConnection()
    expect(result.ok).toBe(false)
  })

  it('does not expose credentials in error message on auth failure', async () => {
    const credClient = new M3UClient(CRED_CONFIG)
    mockFetch.mockResolvedValueOnce(errorResponse(401))
    const result = await credClient.testConnection()
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain('secret_user')
    expect(result.message).not.toContain('secret_pass')
  })

  it('does not expose credentials in error message on network failure', async () => {
    const credClient = new M3UClient(CRED_CONFIG)
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    const result = await credClient.testConnection()
    expect(result.ok).toBe(false)
    expect(result.message).not.toContain('secret_user')
    expect(result.message).not.toContain('secret_pass')
  })

  it('retries with full fetch when range request returns 416', async () => {
    mockFetch
      .mockResolvedValueOnce({ ...okResponse(''), status: 416, ok: false })
      .mockResolvedValueOnce(okResponse(VALID_PLAYLIST))
    const result = await client.testConnection()
    expect(result.ok).toBe(true)
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })
})

describe('M3UClient.fetchSnapshot()', () => {
  let client: M3UClient

  beforeEach(() => {
    mockFetch.mockReset()
    client = new M3UClient(BASE_CONFIG)
  })

  it('returns snapshot with classified movies and episodes', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(VALID_PLAYLIST))
    const snapshot = await client.fetchSnapshot('source-1')
    expect(snapshot.sourceId).toBe('source-1')
    expect(snapshot.movies).toHaveLength(2)
    expect(snapshot.episodes).toHaveLength(2)
    expect(snapshot.unclassified).toHaveLength(0)
  })

  it('throws M3UAuthError on HTTP 401', async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401))
    await expect(client.fetchSnapshot('source-1')).rejects.toBeInstanceOf(M3UAuthError)
  })

  it('throws M3UNetworkError on timeout', async () => {
    mockFetch.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'TimeoutError'))
    await expect(client.fetchSnapshot('source-1')).rejects.toBeInstanceOf(M3UNetworkError)
  })

  it('throws M3UNetworkError on unreachable host', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    await expect(client.fetchSnapshot('source-1')).rejects.toBeInstanceOf(M3UNetworkError)
  })

  it('throws M3UParseError on non-M3U body', async () => {
    mockFetch.mockResolvedValueOnce(okResponse(NON_M3U_BODY))
    await expect(client.fetchSnapshot('source-1')).rejects.toBeInstanceOf(M3UParseError)
  })

  it('does not expose credentials in thrown error messages', async () => {
    const credClient = new M3UClient(CRED_CONFIG)
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
    const err = await credClient.fetchSnapshot('source-1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(M3UNetworkError)
    expect((err as M3UNetworkError).message).not.toContain('secret_user')
    expect((err as M3UNetworkError).message).not.toContain('secret_pass')
  })

  it('substitutes {username} and {password} placeholders in URL', async () => {
    const credClient = new M3UClient(CRED_CONFIG)
    let capturedUrl = ''
    mockFetch.mockImplementationOnce((url: string) => {
      capturedUrl = url
      return Promise.resolve(okResponse(VALID_PLAYLIST))
    })
    await credClient.fetchSnapshot('source-1')
    expect(capturedUrl).toContain('secret_user')
    expect(capturedUrl).toContain('secret_pass')
    // Placeholders must be replaced
    expect(capturedUrl).not.toContain('{username}')
    expect(capturedUrl).not.toContain('{password}')
  })
})
