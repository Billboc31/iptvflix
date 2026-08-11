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

// ---------------------------------------------------------------------------
// GET /movies/:id
// ---------------------------------------------------------------------------

describe('GET /movies/:id', () => {
  it('returns canonical MovieDetailResponse without provider-specific fields', async () => {
    mockDb.select
      .mockReturnValueOnce(selectChain([MOVIE_ROW]))           // movie query
      .mockReturnValueOnce(selectChain([{ name: 'Action' }])) // genres
      .mockReturnValueOnce(selectChain([AVAIL_COUNT_ONE]))     // availability count

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

    const res = await app.inject({ method: 'GET', url: `/movies/${MOVIE_ROW.id}` })
    expect(res.statusCode).toBe(200)
    expect(res.json().availabilityStatus).toBe('UNAVAILABLE')
    expect(res.json().availabilityCount).toBe(0)
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
