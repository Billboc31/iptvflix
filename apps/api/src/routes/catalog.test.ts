import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

const mockDb = vi.hoisted(() => ({ select: vi.fn() }))

vi.mock('../db/client.js', () => ({ db: mockDb }))

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
  audioLanguage: 'fr',
  subtitleLanguage: null,
  videoQuality: '1080p',
  rawTitle: 'Test Movie FRENCH 1080p',
}

const VARIANT_MULTI_4K = {
  id: '00000000-0000-0000-0000-000000000102',
  audioLanguage: null,
  subtitleLanguage: null,
  videoQuality: '4K',
  rawTitle: 'Test Movie MULTI 4K',
}

const VARIANT_VOSTFR = {
  id: '00000000-0000-0000-0000-000000000103',
  audioLanguage: null,
  subtitleLanguage: 'fr',
  videoQuality: null,
  rawTitle: 'Test Movie VOSTFR',
}

// ---------------------------------------------------------------------------
// GET /movies/:id
// ---------------------------------------------------------------------------

describe('GET /movies/:id', () => {
  it('returns canonical MovieDetailResponse without provider-specific fields', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))           // movie query
      .mockReturnValueOnce(selectChain([{ name: 'Action' }])) // genres
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))     // availability count
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080])) // variants

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    // canonical fields present
    expect(body.id).toBe(MOVIE_ROW.id)
    expect(body.title).toBe('Test Movie')
    expect(body.originalTitle).toBe('Original Test Movie')
    expect(body.genres).toEqual(['Action'])
    expect(body.enrichmentStatus).toBe('matched') // tmdbId=12345 + synopsis → matched
    expect(body.availabilityCount).toBe(1)
    expect(body.availabilityStatus).toBe('AVAILABLE')

    // no Xtream-specific keys
    expect(body).not.toHaveProperty('stream_id')
    expect(body).not.toHaveProperty('category_id')
    expect(body).not.toHaveProperty('provider_item_id')
  })

  it('returns enrichmentStatus matched when tmdbId and synopsis are present', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().enrichmentStatus).toBe('matched')
  })

  it('returns enrichmentStatus unmatched when no external ids and no synopsis', async () => {
    const unmatchedRow = { ...MOVIE_ROW, tmdbId: null, imdbId: null, synopsis: null }
    mockDb.select
      .mockReturnValueOnce(selectChain([unmatchedRow]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().enrichmentStatus).toBe('unmatched')
  })

  it('returns 404 for unknown movie id', async () => {
    mockDb.select.mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: '/movies/nonexistent' })
    expect(res.statusCode).toBe(404)
  })

  it('reflects UNAVAILABLE and availabilityCount 0 when no availability rows exist', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().availabilityStatus).toBe('UNAVAILABLE')
    expect(res.json().availabilityCount).toBe(0)
  })

  it('includes variants array in response', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(Array.isArray(body.variants)).toBe(true)
    expect(body.variants).toHaveLength(1)
    expect(body.variants[0].audioLanguage).toBe('fr')
    expect(body.variants[0].videoQuality).toBe('1080p')
  })

  it('two availability rows produce two variants, one canonical movie', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ cnt: 2 }]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080, VARIANT_MULTI_4K]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.variants).toHaveLength(2)
    expect(body.variants[0].audioLanguage).toBe('fr')
    expect(body.variants[0].videoQuality).toBe('1080p')
    expect(body.variants[1].audioLanguage).toBeNull()
    expect(body.variants[1].videoQuality).toBe('4K')
  })

  it('VOSTFR variant has subtitleLanguage fr and audioLanguage null', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([VARIANT_VOSTFR]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()

    expect(body.variants[0].subtitleLanguage).toBe('fr')
    expect(body.variants[0].audioLanguage).toBeNull()
  })

  it('MULTI variant has audioLanguage null', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))
      .mockReturnValueOnce(selectChain([VARIANT_MULTI_4K]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    const body = res.json()

    expect(body.variants[0].audioLanguage).toBeNull()
    expect(body.variants[0].subtitleLanguage).toBeNull()
  })

  it('quality field reflects best videoQuality from variants', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ cnt: 2 }]))
      .mockReturnValueOnce(selectChain([VARIANT_FRENCH_1080, VARIANT_MULTI_4K]))

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.json().quality).toBe('4K')
  })
})

// ---------------------------------------------------------------------------
// GET /series/:id
// ---------------------------------------------------------------------------

describe('GET /series/:id', () => {
  it('returns SeriesDetailResponse with seasons array', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([SERIES_ROW]))        // series query
      .mockReturnValueOnce(selectChain([{ name: 'Drama' }])) // genres
      .mockReturnValueOnce(selectChain([]))                  // availability count (0)
      .mockReturnValueOnce(selectChain([SEASON_ROW]))        // seasons
      .mockReturnValueOnce(selectChain([]))                  // variants

    const res = await app.inject({ method: 'GET', url: `/series/${SERIES_ROW.id}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(Array.isArray(body.seasons)).toBe(true)
    expect(body.seasons).toHaveLength(1)
    expect(body.seasons[0].seasonNumber).toBe(1)
    expect(body.seasons[0].episodeCount).toBe(5)
    expect(body.seasonCount).toBe(1)
    expect(body.availabilityCount).toBe(0)
    expect(body.availabilityStatus).toBe('UNAVAILABLE')
    expect(Array.isArray(body.variants)).toBe(true)
  })

  it('returns 404 for unknown series id', async () => {
    mockDb.select.mockReturnValueOnce(selectChain([]))

    const res = await app.inject({ method: 'GET', url: '/series/nonexistent' })
    expect(res.statusCode).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// GET /series/:id/seasons/:seasonNumber/episodes
// ---------------------------------------------------------------------------

describe('GET /series/:id/seasons/:seasonNumber/episodes', () => {
  const SEASON_DB_ROW = {
    id: '00000000-0000-0000-0000-000000000020',
  }

  it('returns episode list for a valid season', async () => {
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
})

// ---------------------------------------------------------------------------
// GET /movies — list with quality derivation
// ---------------------------------------------------------------------------

describe('GET /movies', () => {
  it('quality field reflects best videoQuality across variants', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([{ total: 1 }]))  // count
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))     // movie rows
      .mockReturnValueOnce(selectChain([]))              // genre rows
      .mockReturnValueOnce(selectChain([{ movieId: MOVIE_ROW.id, cnt: 2 }]))  // avail count
      .mockReturnValueOnce(selectChain([
        { movieId: MOVIE_ROW.id, videoQuality: '1080p' },
        { movieId: MOVIE_ROW.id, videoQuality: '4K' },
      ]))  // quality rows

    const res = await app.inject({ method: 'GET', url: '/movies' })
    expect(res.statusCode).toBe(200)
    const body = res.json()

    expect(body.items).toHaveLength(1)
    expect(body.items[0].quality).toBe('4K')
  })

  it('catalog list has one card per canonical movie — deduplication preserved', async () => {
    // Two availability rows for same movie → single movie in list
    mockDb.select
      .mockReturnValueOnce(selectChain([{ total: 1 }]))
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ movieId: MOVIE_ROW.id, cnt: 2 }]))
      .mockReturnValueOnce(selectChain([
        { movieId: MOVIE_ROW.id, videoQuality: 'fr' },
        { movieId: MOVIE_ROW.id, videoQuality: null },
      ]))

    const res = await app.inject({ method: 'GET', url: '/movies' })
    const body = res.json()

    // Still only one card despite two variants
    expect(body.items).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it('quality is null when all variant qualities are unknown', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([{ total: 1 }]))
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))
      .mockReturnValueOnce(selectChain([]))
      .mockReturnValueOnce(selectChain([{ movieId: MOVIE_ROW.id, cnt: 1 }]))
      .mockReturnValueOnce(selectChain([{ movieId: MOVIE_ROW.id, videoQuality: null }]))

    const res = await app.inject({ method: 'GET', url: '/movies' })
    expect(res.json().items[0].quality).toBeNull()
  })
})
