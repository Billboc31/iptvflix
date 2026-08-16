import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildXtreamStreamUrl } from '../../providers/xtream/playback.js'
import { buildM3UStreamUrl } from '../../providers/m3u/playback.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../../errors.js'
import type { ProfilePreferences } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// URL builders — pure unit tests (no DB needed)
// ---------------------------------------------------------------------------

describe('buildXtreamStreamUrl', () => {
  it('produces the expected path format', () => {
    const url = buildXtreamStreamUrl('http://srv.example.com', 'user', 'pass', '12345')
    expect(url).toBe('http://srv.example.com/user/pass/12345.ts')
  })

  it('strips trailing slash from baseUrl', () => {
    const url = buildXtreamStreamUrl('http://srv.example.com/', 'user', 'pass', '42')
    expect(url).toBe('http://srv.example.com/user/pass/42.ts')
  })

  it('respects explicit ext parameter', () => {
    const url = buildXtreamStreamUrl('http://srv.example.com', 'u', 'p', '99', 'mp4')
    expect(url).toBe('http://srv.example.com/u/p/99.mp4')
  })

  it('does not throw or log credentials', () => {
    const logged: string[] = []
    const spy = vi.spyOn(console, 'log').mockImplementation((msg: string) => {
      logged.push(msg)
    })
    buildXtreamStreamUrl('http://x.example.com', 'secret_user', 'secret_pass', '1')
    spy.mockRestore()
    for (const entry of logged) {
      expect(entry).not.toContain('secret_user')
      expect(entry).not.toContain('secret_pass')
    }
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

const EMPTY_PREFS: ProfilePreferences = {
  preferredAudioLanguages: [],
  preferredSubtitleLanguages: [],
  preferredSourceIds: [],
  maxVideoQuality: null,
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
    expect(session.streamUrl).toBe('http://xtream.example.com/user/pass/999.ts')
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
    expect(session.streamUrl).toBe('http://xtream.example.com/user/pass/2.ts')
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

    expect(session.streamUrl).toBe(streamUrl)
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

    const session = await resolvePlayback('profile-1', 'movie', 'movie-uuid-1')

    consoleSpy.mockRestore()
    errorSpy.mockRestore()

    // Verify no logged message contains the credential-bearing URL
    for (const entry of logged) {
      expect(entry).not.toContain('secret_user')
      expect(entry).not.toContain('secret_pass')
    }
    // Confirm the URL was built correctly
    expect(session.streamUrl).toContain('secret_user')
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
