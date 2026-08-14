import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import type { MetadataEnrichmentService } from '../services/metadata-enrichment-service.js'

const mockDb = vi.hoisted(() => ({ select: vi.fn() }))
vi.mock('../db/client.js', () => ({ db: mockDb }))

const mockGetDefaultProfilePreferences = vi.hoisted(() => vi.fn())
vi.mock('../services/profile-service.js', () => ({
  getDefaultProfilePreferences: mockGetDefaultProfilePreferences,
}))

import { catalogRoutes } from './catalog.js'

// ---------------------------------------------------------------------------
// Chainable mock helper — returns a thenable with all Drizzle fluent methods
// ---------------------------------------------------------------------------

function selectChain(rows: unknown[]) {
  const p = Promise.resolve(rows)
  const chain: Record<string, unknown> = {
    then: p.then.bind(p),
    catch: p.catch.bind(p),
    finally: p.finally.bind(p),
  }
  for (const method of [
    'from', 'leftJoin', 'innerJoin', 'where', 'limit', 'offset', 'orderBy', 'groupBy',
  ]) {
    chain[method] = vi.fn().mockReturnValue(chain)
  }
  return chain
}

const EMPTY_PREFS = {
  preferredAudioLanguages: [],
  preferredSubtitleLanguages: [],
  preferredSourceIds: [],
  maxVideoQuality: null,
}

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = Fastify({ logger: false })

beforeAll(async () => {
  await app.register(catalogRoutes)
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDefaultProfilePreferences.mockResolvedValue(EMPTY_PREFS)
})

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOVIE_ROW = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'Test Movie',
  originalTitle: 'Original Test Movie',
  year: 2024,
  durationMinutes: 120,
  synopsis: 'A test synopsis.',
  posterPath: null,
  backdropPath: null,
  tmdbId: 12345,
  imdbId: null,
  voteAverage: 7.8,
  certification: 'PG-13',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const SERIES_ROW = {
  id: '00000000-0000-0000-0000-000000000002',
  title: 'Test Series',
  originalTitle: null,
  firstAirYear: 2023,
  synopsis: 'A test series synopsis.',
  posterPath: null,
  backdropPath: null,
  tmdbId: null,
  imdbId: null,
  voteAverage: 8.1,
  certification: 'TV-MA',
  status: 'Returning Series',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const SEASON_ROW = {
  seasonNumber: 1,
  title: 'Season One',
  airYear: 2023,
  episodeCount: 5,
}

const EPISODE_ROW = {
  id: '00000000-0000-0000-0000-000000000010',
  seasonId: '00000000-0000-0000-0000-000000000020',
  seriesId: SERIES_ROW.id,
  episodeNumber: 1,
  title: 'Pilot',
  synopsis: 'First episode.',
  durationMinutes: 45,
  airDate: '2023-01-01',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const AVAIL_COUNT_ONE = { cnt: 1 }

const VARIANT_FRENCH_1080 = {
  id: '00000000-0000-0000-0000-000000000101',
  status: 'AVAILABLE' as const,
  providerId: 'source-1',
  audioLanguage: 'fr',
  subtitleLanguage: null,
  videoQuality: '1080p',
  rawTitle: 'Test Movie FRENCH 1080p',
}

const VARIANT_MULTI_4K = {
  id: '00000000-0000-0000-0000-000000000102',
  status: 'AVAILABLE' as const,
  providerId: 'source-2',
  audioLanguage: null,
  subtitleLanguage: null,
  videoQuality: '4K',
  rawTitle: 'Test Movie MULTI 4K',
}

const VARIANT_VOSTFR = {
  id: '00000000-0000-0000-0000-000000000103',
  status: 'AVAILABLE' as const,
  providerId: 'source-1',
  audioLanguage: null,
  subtitleLanguage: 'fr',
  videoQuality: null,
  rawTitle: 'Test Movie VOSTFR',
}

const VIDEO_TRAILER = {
  youtubeKey: 'abc123',
  videoType: 'Trailer',
  official: true,
}

const CREDIT_CAST = {
  role: 'cast',
  name: 'Jane Doe',
  character: 'Hero',
  creditOrder: 0,
  profilePath: null,
}

const CREDIT_DIRECTOR = {
  role: 'director',
  name: 'Denis Villeneuve',
  character: null,
  creditOrder: 0,
  profilePath: null,
}

// ---------------------------------------------------------------------------
// GET /movies/:id
// ---------------------------------------------------------------------------

describe('GET /movies/:id', () => {
  it('returns MovieDetailResponse with selectedVariantId and variant status/providerId', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))           // movie query
      .mockReturnValueOnce(selectChain([{ name: 'Action' }])) // genres
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))     // availability count
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080])) // variants
      .mockReturnValueOnce(selectChain([]))                    // videos
      .mockReturnValueOnce(selectChain([]))                    // credits

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.id).toBe(MOVIE_ROW.id)
    expect(body.title).toBe('Test Movie')
    expect(body.enrichmentStatus).toBe('matched')
    expect(body.availabilityCount).toBe(1)
    expect(body.availabilityStatus).toBe('AVAILABLE')

    // resolver fields
    expect(body).toHaveProperty('selectedVariantId', VARIANT_FRENCH_1080.id)

    // no Xtream-specific keys
    expect(body).not.toHaveProperty('stream_id')
    expect(body).not.toHaveProperty('category_id')
  })

  it('variant objects include status and providerId', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()

    expect(body.variants[0].status).toBe('AVAILABLE')
    expect(body.variants[0].providerId).toBe('source-1')
  })

  it('selectedVariantId is null when no AVAILABLE variants exist', async () => {
    const unavailVariant = { ...VARIANT_FRENCH_1080, status: 'UNAVAILABLE' as const }
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([unavailVariant]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()
    expect(body.selectedVariantId).toBeNull()
  })

  it('returns enrichmentStatus matched when tmdbId and synopsis are present', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().enrichmentStatus).toBe('matched')
  })

  it('returns enrichmentStatus unmatched when no external ids and no synopsis', async () => {
    const unmatchedRow = { ...MOVIE_ROW, tmdbId: null, imdbId: null, synopsis: null }
    mockDb.select
      .mockReturnValueOnce(selectChain([unmatchedRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().enrichmentStatus).toBe('unmatched')
  })

  it('returns 404 for unknown movie id', async () => {
    mockDb.select.mockReturnValueOnce(selectChain([]))
    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id.slice(0, -1)}f` })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 without querying DB when id is not a valid UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/movies/not-a-uuid' })
    expect(res.statusCode).toBe(404)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('reflects UNAVAILABLE and availabilityCount 0 when no availability rows exist', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().availabilityStatus).toBe('UNAVAILABLE')
    expect(res.json().availabilityCount).toBe(0)
  })

  it('includes variants array in response', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()

    expect(Array.isArray(body.variants)).toBe(true)
    expect(body.variants).toHaveLength(1)
    expect(body.variants[0].audioLanguage).toBe('fr')
    expect(body.variants[0].videoQuality).toBe('1080p')
  })

  it('two availability rows produce two variants and selectedVariantId points to best', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ cnt: 2 }]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080, VARIANT_MULTI_4K]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()

    expect(body.variants).toHaveLength(2)
    // With empty prefs, quality wins: 4K > 1080p → VARIANT_MULTI_4K selected
    expect(body.selectedVariantId).toBe(VARIANT_MULTI_4K.id)
  })

  it('VOSTFR variant has subtitleLanguage fr and audioLanguage null', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([VARIANT_VOSTFR]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()

    expect(body.variants[0].subtitleLanguage).toBe('fr')
    expect(body.variants[0].audioLanguage).toBeNull()
  })

  it('quality field reflects best videoQuality from variants', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ cnt: 2 }]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080, VARIANT_MULTI_4K]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().quality).toBe('4K')
  })

  it('profile audio preference selects fr variant over 4K null-audio variant', async () => {
    mockGetDefaultProfilePreferences.mockResolvedValue({
      ...EMPTY_PREFS,
      preferredAudioLanguages: ['fr'],
    })

    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ cnt: 2 }]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080, VARIANT_MULTI_4K]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()
    expect(body.selectedVariantId).toBe(VARIANT_FRENCH_1080.id)
  })

  it('returns trailerKey from mediaVideos when present', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([VIDEO_TRAILER]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().trailerKey).toBe('abc123')
  })

  it('returns trailerKey null when no mediaVideos row exists', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().trailerKey).toBeNull()
  })

  it('returns cast array and director from mediaCredits', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([CREDIT_CAST, CREDIT_DIRECTOR]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()
    expect(body.cast).toHaveLength(1)
    expect(body.cast[0].name).toBe('Jane Doe')
    expect(body.cast[0].character).toBe('Hero')
    expect(body.director).toBe('Denis Villeneuve')
  })

  it('returns empty cast and null director when no mediaCredits exist', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()
    expect(body.cast).toEqual([])
    expect(body.director).toBeNull()
  })

  it('returns voteAverage and certification from movie row', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()
    expect(body.voteAverage).toBe(7.8)
    expect(body.certification).toBe('PG-13')
  })
})

// ---------------------------------------------------------------------------
// GET /series/:id
// ---------------------------------------------------------------------------

describe('GET /series/:id', () => {
  it('returns SeriesDetailResponse with selectedVariantId and seasons array', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_ROW]))        // series query
      .mockReturnValueOnce(selectChain([{ name: 'Drama' }])) // genres
      .mockReturnValueOnce(selectChain([]))                  // availability count (0)
      .mockReturnValueOnce(selectChain([SEASON_ROW]))        // seasons
      .mockReturnValueOnce(selectChain([]))                  // variants
      .mockReturnValueOnce(selectChain([]))                  // available ep count per season
      .mockReturnValueOnce(selectChain([]))                  // videos
      .mockReturnValueOnce(selectChain([]))                  // credits

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(Array.isArray(body.seasons)).toBe(true)
    expect(body.seasons).toHaveLength(1)
    expect(body.seasons[0].seasonNumber).toBe(1)
    expect(body.seasons[0].episodeCount).toBe(5)
    expect(body.seasons[0].availableEpisodeCount).toBe(0)
    expect(body.seasonCount).toBe(1)
    expect(body.availabilityCount).toBe(0)
    expect(body.availabilityStatus).toBe('UNAVAILABLE')
    expect(Array.isArray(body.variants)).toBe(true)
    expect(body).toHaveProperty('selectedVariantId')
    expect(body.selectedVariantId).toBeNull()
  })

  it('returns availableEpisodeCount per season aggregated from episode availabilities', async () => {
    const S1 = { seasonNumber: 1, title: null, airYear: 2023, episodeCount: 3 }
    const S2 = { seasonNumber: 2, title: null, airYear: 2024, episodeCount: 4 }

    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_ROW]))  // series
      .mockReturnValueOnce(selectChain([]))             // genres
      .mockReturnValueOnce(selectChain([]))             // avail count
      .mockReturnValueOnce(selectChain([S1, S2]))       // seasons
      .mockReturnValueOnce(selectChain([]))             // variants
      .mockReturnValueOnce(selectChain([{ seasonNumber: 1, cnt: 2 }])) // avail ep count (S2 absent → 0)
      .mockReturnValueOnce(selectChain([]))             // videos
      .mockReturnValueOnce(selectChain([]))             // credits

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.seasons[0].availableEpisodeCount).toBe(2)
    expect(body.seasons[1].availableEpisodeCount).toBe(0)
  })

  it('returns 404 for unknown series id', async () => {
    mockDb.select.mockReturnValueOnce(selectChain([]))
    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ROW.id.slice(0, -1)}f` })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 without querying DB when id is not a valid UUID', async () => {
    const res = await app.inject({ method: 'GET', url: '/series/not-a-uuid' })
    expect(res.statusCode).toBe(404)
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('returns trailerKey, cast, director, voteAverage, certification and status for rich series', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([VIDEO_TRAILER]))
      .mockReturnValueOnce(selectChain([CREDIT_CAST, CREDIT_DIRECTOR]))

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.trailerKey).toBe('abc123')
    expect(body.cast).toHaveLength(1)
    expect(body.cast[0].name).toBe('Jane Doe')
    expect(body.director).toBe('Denis Villeneuve')
    expect(body.voteAverage).toBe(8.1)
    expect(body.certification).toBe('TV-MA')
    expect(body.status).toBe('Returning Series')
  })

  it('returns trailerKey null for series without videos', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ROW.id}` })
    expect(res.json().trailerKey).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// GET /series/:id/seasons/:seasonNumber/episodes
// ---------------------------------------------------------------------------

describe('GET /series/:id/seasons/:seasonNumber/episodes', () => {
  const SEASON_DB_ROW = {
    id: '00000000-0000-0000-0000-000000000020',
  }

  it('returns episode list with selectedVariantId for a valid season', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SEASON_DB_ROW]))                              // find season
      .mockReturnValueOnce(selectChain([EPISODE_ROW]))                               // episodes
      .mockReturnValueOnce(selectChain([{ episodeId: EPISODE_ROW.id, cnt: 1 }]))     // availability count
      .mockReturnValueOnce(selectChain([]))                                           // variants

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe(EPISODE_ROW.id)
    expect(body[0].episodeNumber).toBe(1)
    expect(body[0].title).toBe('Pilot')
    expect(body[0].availabilityCount).toBe(1)
    expect(body[0].availabilityStatus).toBe('AVAILABLE')
    expect(Array.isArray(body[0].variants)).toBe(true)
    expect(body[0]).toHaveProperty('selectedVariantId')
  })

  it('returns empty array when season has no episodes', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SEASON_DB_ROW]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('returns 404 when season does not exist', async () => {
    mockDb.select.mockReturnValueOnce(selectChain([]))

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/99/episodes`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns watchState null for all episodes when profileId is absent', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SEASON_DB_ROW]))
      .mockReturnValueOnce(selectChain([EPISODE_ROW]))
      .mockReturnValueOnce(selectChain([{ episodeId: EPISODE_ROW.id, cnt: 1 }]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()[0].watchState).toBeNull()
  })

  it('returns correct watchState per episode when profileId is provided', async () => {
    const EP_1 = { ...EPISODE_ROW, id: '00000000-0000-0000-0000-000000000011', episodeNumber: 1 }
    const EP_2 = { ...EPISODE_ROW, id: '00000000-0000-0000-0000-000000000012', episodeNumber: 2 }
    const EP_3 = { ...EPISODE_ROW, id: '00000000-0000-0000-0000-000000000013', episodeNumber: 3 }
    const profileId = '00000000-0000-0000-0000-000000000001'

    mockDb.select
      .mockReturnValueOnce(selectChain([SEASON_DB_ROW]))           // find season
      .mockReturnValueOnce(selectChain([EP_1, EP_2, EP_3]))        // episodes
      .mockReturnValueOnce(selectChain([]))                        // avail count
      .mockReturnValueOnce(selectChain([]))                        // variants
      .mockReturnValueOnce(selectChain([                           // viewingProgress
        { mediaId: EP_1.id, progressSeconds: 90, durationSeconds: 100 },  // watched
        { mediaId: EP_2.id, progressSeconds: 50, durationSeconds: 100 },  // in_progress
        // EP_3 has no progress record → unwatched
      ]))

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes?profileId=${profileId}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body[0].watchState).toBe('watched')
    expect(body[1].watchState).toBe('in_progress')
    expect(body[2].watchState).toBe('unwatched')
  })

  it('episode with multiple AVAILABLE variants appears once with all variants', async () => {
    const VARIANT_1 = {
      episodeId: EPISODE_ROW.id, id: '00000000-0000-0000-0000-000000000101',
      status: 'AVAILABLE' as const, providerId: 'plex',
      audioLanguage: 'fr', subtitleLanguage: null, videoQuality: '1080p', rawTitle: null,
    }
    const VARIANT_2 = {
      episodeId: EPISODE_ROW.id, id: '00000000-0000-0000-0000-000000000102',
      status: 'AVAILABLE' as const, providerId: 'iptv',
      audioLanguage: null, subtitleLanguage: null, videoQuality: '4K', rawTitle: null,
    }

    mockDb.select
      .mockReturnValueOnce(selectChain([SEASON_DB_ROW]))
      .mockReturnValueOnce(selectChain([EPISODE_ROW]))
      .mockReturnValueOnce(selectChain([{ episodeId: EPISODE_ROW.id, cnt: 2 }]))
      .mockReturnValueOnce(selectChain([VARIANT_1, VARIANT_2]))

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body).toHaveLength(1)
    expect(body[0].variants).toHaveLength(2)
    expect(body[0].availabilityCount).toBe(2)
  })

  it('returns 400 when profileId is not a valid UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes?profileId=not-a-uuid`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('episode with all UNAVAILABLE variants shows availabilityStatus UNAVAILABLE and watchState null', async () => {
    const UNAVAIL_VARIANT = {
      episodeId: EPISODE_ROW.id, id: '00000000-0000-0000-0000-000000000103',
      status: 'UNAVAILABLE' as const, providerId: 'plex',
      audioLanguage: null, subtitleLanguage: null, videoQuality: null, rawTitle: null,
    }

    mockDb.select
      .mockReturnValueOnce(selectChain([SEASON_DB_ROW]))
      .mockReturnValueOnce(selectChain([EPISODE_ROW]))
      .mockReturnValueOnce(selectChain([]))  // no AVAILABLE count
      .mockReturnValueOnce(selectChain([UNAVAIL_VARIANT]))

    const res = await app.inject({
      method: 'GET',
      url: `/series/${SERIES_ROW.id}/seasons/1/episodes`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body[0].availabilityStatus).toBe('UNAVAILABLE')
    expect(body[0].availabilityCount).toBe(0)
    expect(body[0].watchState).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// GET /series/:id — on-demand hierarchy hydration
// ---------------------------------------------------------------------------

describe('GET /series/:id — on-demand hierarchy hydration', () => {
  const SERIES_WITH_TMDB = {
    id: '00000000-0000-0000-0000-000000000099',
    title: 'Source-Free Series',
    originalTitle: null,
    firstAirYear: 2024,
    synopsis: 'No sources yet.',
    posterPath: null,
    backdropPath: null,
    tmdbId: 9999,
    imdbId: null,
    voteAverage: null,
    certification: null,
    status: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  let hydrationApp: ReturnType<typeof Fastify>
  const mockEnrichSeries = vi.fn().mockResolvedValue('enriched')
  const mockEnrichmentService = {
    enrichSeries: mockEnrichSeries,
  } as unknown as MetadataEnrichmentService

  beforeAll(async () => {
    hydrationApp = Fastify({ logger: false })
    await hydrationApp.register(catalogRoutes, { enrichmentService: mockEnrichmentService })
    await hydrationApp.ready()
  })

  afterAll(async () => {
    await hydrationApp.close()
  })

  afterEach(() => {
    mockEnrichSeries.mockClear()
  })

  it('sets X-Hierarchy-Hydrating header and calls enrichSeries when seasons empty and tmdbId set', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_WITH_TMDB]))  // series
      .mockReturnValueOnce(selectChain([]))                   // genres
      .mockReturnValueOnce(selectChain([]))                   // avail count
      .mockReturnValueOnce(selectChain([]))                   // seasons (empty!)
      .mockReturnValueOnce(selectChain([]))                   // variants
      .mockReturnValueOnce(selectChain([]))                   // avail ep count
      .mockReturnValueOnce(selectChain([]))                   // videos
      .mockReturnValueOnce(selectChain([]))                   // credits

    const res = await hydrationApp.inject({ method: 'GET', url: `/series/${SERIES_WITH_TMDB.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-hierarchy-hydrating']).toBe('true')
    // fire-and-forget: may not be called synchronously, but it is triggered
    // use a small flush to let the microtask queue drain
    await new Promise((r) => setTimeout(r, 0))
    expect(mockEnrichSeries).toHaveBeenCalledWith(SERIES_WITH_TMDB.id)
  })

  it('does not set X-Hierarchy-Hydrating when seasons already exist', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_WITH_TMDB]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([SEASON_ROW]))  // seasons present
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await hydrationApp.inject({ method: 'GET', url: `/series/${SERIES_WITH_TMDB.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-hierarchy-hydrating']).toBeUndefined()
    expect(mockEnrichSeries).not.toHaveBeenCalled()
  })

  it('does not set X-Hierarchy-Hydrating when tmdbId is null', async () => {
    const seriesNoTmdb = { ...SERIES_WITH_TMDB, tmdbId: null }
    mockDb.select
      .mockReturnValueOnce(selectChain([seriesNoTmdb]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))  // seasons empty
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await hydrationApp.inject({ method: 'GET', url: `/series/${SERIES_WITH_TMDB.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.headers['x-hierarchy-hydrating']).toBeUndefined()
    expect(mockEnrichSeries).not.toHaveBeenCalled()
  })
})
