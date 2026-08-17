import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildXtreamMovieUrl, buildXtreamEpisodeUrl, xtreamUrlFallbacks, browserSafeXtreamUrl } from '../../providers/xtream/playback.js'
import { buildM3UStreamUrl } from '../../providers/m3u/playback.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../../errors.js'
import type { ProfilePreferences } from '@iptvflix/api-contracts'

// Mock session store so resolver tests don't depend on it
vi.mock('../playback-session-store.js', () => ({
  createSession: vi.fn(() => 'test-session-id'),
  patchSession: vi.fn(),
}))

// Probe returns h264+aac+mp4 by default → classifyDelivery → DIRECT → no HLS session needed
vi.mock('../media-prober.js', () => ({
  probeMedia: vi.fn().mockResolvedValue({
    videoCodec: 'h264',
    audioCodec: 'aac',
    containerFormat: 'mov,mp4,m4a,3gp,3g2,mj2',
  }),
}))

vi.mock('../probe-cache.js', () => ({
  getProbe: vi.fn().mockReturnValue(null),
  setProbe: vi.fn(),
}))

// HLS session creation is a no-op in resolver tests (DIRECT mode is returned by default)
vi.mock('../hls-session-store.js', () => ({
  createHlsSession: vi.fn().mockResolvedValue(undefined),
  waitForPlaylist: vi.fn().mockResolvedValue(true),
}))

vi.mock('../ffmpeg-availability.js', () => ({
  isFfmpegAvailable: vi.fn().mockResolvedValue(true),
}))

vi.mock('../../providers/xtream/playback.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../providers/xtream/playback.js')>()
  return {
    ...actual,
    pickWorkingXtreamUrl: vi.fn(async (url: string) => url),
  }
})

// ---------------------------------------------------------------------------
// URL builders — pure unit tests (no DB needed)
// ---------------------------------------------------------------------------

describe('buildXtreamMovieUrl', () => {
  it('produces the expected movie path format', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'user', 'pass', '12345', 'ts')
    expect(url).toBe('http://srv.example.com/movie/user/pass/12345.ts')
  })

  it('strips trailing slash from baseUrl', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com/', 'user', 'pass', '42', 'ts')
    expect(url).toBe('http://srv.example.com/movie/user/pass/42.ts')
  })

  it('respects mp4 extension', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99', 'mp4')
    expect(url).toBe('http://srv.example.com/movie/u/p/99.mp4')
  })

  it('respects mkv extension', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99', 'mkv')
    expect(url).toBe('http://srv.example.com/movie/u/p/99.mkv')
  })

  it('falls back to ts when extension is null', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99', null)
    expect(url).toBe('http://srv.example.com/movie/u/p/99.ts')
  })

  it('falls back to ts when extension is omitted', () => {
    const url = buildXtreamMovieUrl('http://srv.example.com', 'u', 'p', '99')
    expect(url).toBe('http://srv.example.com/movie/u/p/99.ts')
  })

  it('does not log credentials', () => {
    const logged: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logged.push(msg)
    })
    buildXtreamMovieUrl('http://x.example.com', 'secret_user', 'secret_pass', '1', 'mp4')
    spy.mockRestore()
    for (const entry of logged) {
      expect(entry).not.toContain('secret_user')
      expect(entry).not.toContain('secret_pass')
    }
  })
})

describe('browserSafeXtreamUrl', () => {
  it('upgrades http to https without logging credentials', () => {
    const url = browserSafeXtreamUrl('http://srv.example.com/movie/user/pass/1.ts')
    expect(url).toBe('https://srv.example.com/movie/user/pass/1.ts')
  })
})

describe('xtreamUrlFallbacks', () => {
  it('adds movie and live-style alternates without duplicating the original', () => {
    const original = 'http://srv.example.com/movie/user/pass/123.ts'
    const urls = xtreamUrlFallbacks(original)
    expect(urls[0]).toBe(original)
    expect(urls).toContain('http://srv.example.com/movie/user/pass/123.mkv')
    expect(urls).toContain('http://srv.example.com/user/pass/123.ts')
    expect(urls).toContain('http://srv.example.com/live/user/pass/123.ts')
    expect(urls).toContain('https://srv.example.com/movie/user/pass/123.ts')
    expect(new Set(urls).size).toBe(urls.length)
  })
})

describe('buildXtreamEpisodeUrl', () => {
  it('includes /series/ prefix in the path', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'user', 'pass', '55', 'mkv')
    expect(url).toBe('http://srv.example.com/series/user/pass/55.mkv')
  })

  it('strips trailing slash from baseUrl', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com/', 'user', 'pass', '55', 'mp4')
    expect(url).toBe('http://srv.example.com/series/user/pass/55.mp4')
  })

  it('respects the container extension', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '77', 'avi')
    expect(url).toBe('http://srv.example.com/series/u/p/77.avi')
  })

  it('falls back to ts when extension is null', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '77', null)
    expect(url).toBe('http://srv.example.com/series/u/p/77.ts')
  })

  it('falls back to ts when extension is omitted', () => {
    const url = buildXtreamEpisodeUrl('http://srv.example.com', 'u', 'p', '77')
    expect(url).toBe('http://srv.example.com/series/u/p/77.ts')
  })
})

describe('buildM3UStreamUrl', () => {
  it('returns the stream URL unchanged', () => {
    const raw = 'http://cdn.example.com/live/channel1.m3u8'
    expect(buildM3UStreamUrl(raw)).toBe(raw)
  })
})

// ---------------------------------------------------------------------------
// resolvePlayback — service tests with mocked DB
// ---------------------------------------------------------------------------

// Queue of results returned by db.select().from().where() in order of invocation
const dbResultQueue: unknown[][] = []

vi.mock('../../db/client.js', () => {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => Promise.resolve(dbResultQueue.shift() ?? [])),
    select: vi.fn().mockReturnThis(),
  }
  // select() returns the chain
  chain.select = vi.fn().mockReturnValue(chain)
  const db = { select: chain.select }
  return { db }
})

vi.mock('../profile-service.js', () => ({
  getDefaultProfilePreferences: vi.fn(),
}))

// Import after mocks are defined
import { resolvePlayback } from '../playback-resolver.js'
import { getDefaultProfilePreferences } from '../profile-service.js'
import { createSession } from '../playback-session-store.js'

const EMPTY_PREFS: ProfilePreferences = {
  preferredAudioLanguages: [],
  preferredSubtitleLanguages: [],
  preferredSourceIds: [],
  maxVideoQuality: null,
  autoplayPreviews: false,
}

function makeAvailability(overrides: {
  id: string
  status?: 'AVAILABLE' | 'UNAVAILABLE'
  providerId?: string
  providerItemId?: string
  audioLanguage?: string | null
  subtitleLanguage?: string | null
  videoQuality?: string | null
  rawTitle?: string | null
  containerExtension?: string | null
}) {
  return {
    id: overrides.id,
    status: overrides.status ?? 'AVAILABLE',
    providerId: overrides.providerId ?? 'source-uuid-1',
    providerItemId: overrides.providerItemId ?? 'item-1',
    audioLanguage: overrides.audioLanguage ?? null,
    subtitleLanguage: overrides.subtitleLanguage ?? null,
    videoQuality: overrides.videoQuality ?? null,
    rawTitle: overrides.rawTitle ?? null,
    containerExtension: overrides.containerExtension ?? null,
  }
}

function makeSource(overrides: {
  id: string
  type?: 'XTREAM' | 'M3U' | 'PLEX'
  baseUrl?: string
  username?: string | null
  password?: string | null
  enabled?: boolean
}) {
  return {
    id: overrides.id,
    name: 'Test Source',
    type: overrides.type ?? 'XTREAM',
    baseUrl: overrides.baseUrl ?? 'http://xtream.example.com',
    username: overrides.username ?? 'user',
    password: overrides.password ?? 'pass',
    enabled: overrides.enabled ?? true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

beforeEach(() => {
  dbResultQueue.length = 0
  vi.mocked(getDefaultProfilePreferences).mockResolvedValue(EMPTY_PREFS)
})

// ---------------------------------------------------------------------------
// Preferred-variant selection
// ---------------------------------------------------------------------------

describe('preferred-variant selection', () => {
  it('resolves the sole AVAILABLE variant', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '999' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])           // fetchAvailabilities
    dbResultQueue.push([src])          // source lookup
    dbResultQueue.push([])             // fetchProgress → no progress row

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.availabilityId).toBe('av-1')
    expect(session.startPositionSeconds).toBe(0)
    expect(session.alternatives).toHaveLength(0)
    expect(session.gatewayUrl).toBe('/playback/stream/test-session-id')
    expect(session.deliveryMode).toBe('DIRECT')
    // Provider URL must NOT appear in the response (credentials stay server-side)
    expect(JSON.stringify(session)).not.toContain('xtream.example.com')
  })

  it('picks the highest-quality variant when multiple are available', async () => {
    const av1 = makeAvailability({ id: 'av-1', providerItemId: '1', videoQuality: '720p' })
    const av2 = makeAvailability({ id: 'av-2', providerItemId: '2', videoQuality: '1080p' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av1, av2])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.availabilityId).toBe('av-2')
    expect(session.alternatives).toHaveLength(1)
    expect(session.alternatives[0]?.id).toBe('av-1')
  })
})

// ---------------------------------------------------------------------------
// Explicit availabilityId — accepted when valid
// ---------------------------------------------------------------------------

describe('explicit availabilityId', () => {
  it('accepts a valid explicit availabilityId', async () => {
    const av1 = makeAvailability({ id: 'av-1', providerItemId: '1', videoQuality: '1080p' })
    const av2 = makeAvailability({ id: 'av-2', providerItemId: '2', videoQuality: '720p' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av1, av2])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    // Explicitly pick the lower-quality one
    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1', 'av-2')

    expect(session.availabilityId).toBe('av-2')
    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
  })

  it('rejects an explicit availabilityId not found in this media', async () => {
    const av = makeAvailability({ id: 'av-1' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    await expect(
      resolvePlayback('profile-1', 'movie', 'movie-uuid-1', 'av-unknown'),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('rejects an explicit availabilityId with status UNAVAILABLE', async () => {
    const av = makeAvailability({ id: 'av-1', status: 'UNAVAILABLE' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    await expect(
      resolvePlayback('profile-1', 'movie', 'movie-uuid-1', 'av-1'),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('rejects an explicit availabilityId whose source is disabled', async () => {
    const av = makeAvailability({ id: 'av-1' })
    const src = makeSource({ id: 'source-uuid-1', enabled: false })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    await expect(
      resolvePlayback('profile-1', 'movie', 'movie-uuid-1', 'av-1'),
    ).rejects.toBeInstanceOf(ForbiddenError)
  })

  it('uses containerExtension from explicitly selected availability', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '500', containerExtension: 'mkv' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1', 'av-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ containerExtension: 'mkv' }),
    )
  })
})

// ---------------------------------------------------------------------------
// Xtream VOD URL construction — container extension
// ---------------------------------------------------------------------------

describe('Xtream movie URL construction', () => {
  it('uses mp4 extension when containerExtension is mp4', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '100', containerExtension: 'mp4' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ containerExtension: 'mp4' }),
    )
  })

  it('uses mkv extension when containerExtension is mkv', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '101', containerExtension: 'mkv' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ containerExtension: 'mkv' }),
    )
  })

  it('falls back to ts when containerExtension is null', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '102', containerExtension: null })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ containerExtension: 'ts' }),
    )
  })
})

describe('Xtream episode URL construction', () => {
  it('includes /series/ in the path for episodes', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '200', containerExtension: 'mp4' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'episode', 'episode-uuid-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ containerExtension: 'mp4', mediaType: 'episode' }),
    )
  })

  it('falls back to ts when episode containerExtension is null', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '201', containerExtension: null })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'episode', 'episode-uuid-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    expect(vi.mocked(createSession)).toHaveBeenCalledWith(
      expect.objectContaining({ containerExtension: 'ts', mediaType: 'episode' }),
    )
  })
})

// ---------------------------------------------------------------------------
// Resume position from viewingProgress
// ---------------------------------------------------------------------------

describe('resume position', () => {
  it('returns stored progressSeconds as startPositionSeconds', async () => {
    const av = makeAvailability({ id: 'av-1' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([{ progressSeconds: 420 }]) // resume at 420 s

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.startPositionSeconds).toBe(420)
  })

  it('returns 0 when no progress row exists', async () => {
    const av = makeAvailability({ id: 'av-1' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([]) // no progress

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.startPositionSeconds).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// M3U stream URL
// ---------------------------------------------------------------------------

describe('M3U provider', () => {
  it('returns providerItemId directly as streamUrl for M3U sources', async () => {
    const streamUrl = 'http://cdn.example.com/live/ch1.m3u8'
    const av = makeAvailability({ id: 'av-m3u', providerItemId: streamUrl, providerId: 'src-m3u' })
    const src = makeSource({ id: 'src-m3u', type: 'M3U', baseUrl: 'http://cdn.example.com' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    // The raw M3U URL must not appear in the response
    expect(JSON.stringify(session)).not.toContain(streamUrl)
  })
})

// ---------------------------------------------------------------------------
// Secret redaction — streamUrl must not appear in any logged output
// ---------------------------------------------------------------------------

describe('secret redaction', () => {
  it('does not log the streamUrl containing credentials', async () => {
    const av = makeAvailability({ id: 'av-1', providerItemId: '777' })
    const src = makeSource({
      id: 'source-uuid-1',
      username: 'secret_user',
      password: 'secret_pass',
    })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    const logged: string[] = []
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logged.push(String(msg))
    })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation((msg: string) => {
      logged.push(String(msg))
    })
    const infoSpy = vi.spyOn(console, 'info').mockImplementation((msg: string) => {
      logged.push(String(msg))
    })

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    consoleSpy.mockRestore()
    errorSpy.mockRestore()
    infoSpy.mockRestore()

    // Verify no logged message contains the credential-bearing URL
    for (const entry of logged) {
      expect(entry).not.toContain('secret_user')
      expect(entry).not.toContain('secret_pass')
    }
    // Confirm the gateway URL is returned (not the raw provider URL)
    expect(session.gatewayUrl).toMatch(/^\/playback\/stream\//)
    // Provider credentials must NOT appear in the response
    expect(JSON.stringify(session)).not.toContain('secret_user')
    expect(JSON.stringify(session)).not.toContain('secret_pass')
  })
})

// ---------------------------------------------------------------------------
// No available variant — ValidationError when no candidates
// ---------------------------------------------------------------------------

describe('no available variant', () => {
  it('throws ValidationError when all availabilities are UNAVAILABLE', async () => {
    const av = makeAvailability({ id: 'av-1', status: 'UNAVAILABLE' })
    const src = makeSource({ id: 'source-uuid-1' })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    await expect(
      resolvePlayback('profile-1', 'movie', 'movie-uuid-1'),
    ).rejects.toBeInstanceOf(ValidationError)
  })

  it('throws ValidationError when source is disabled and no other source exists', async () => {
    const av = makeAvailability({ id: 'av-1' })
    const src = makeSource({ id: 'source-uuid-1', enabled: false })

    dbResultQueue.push([av])
    dbResultQueue.push([src])
    dbResultQueue.push([])

    await expect(
      resolvePlayback('profile-1', 'movie', 'movie-uuid-1'),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})
