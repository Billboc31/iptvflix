import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../client.js'
import { genres } from '../schema/genres.js'
import { movies } from '../schema/movies.js'
import { series } from '../schema/series.js'
import { seasons } from '../schema/seasons.js'
import { episodes } from '../schema/episodes.js'
import { movieAvailabilities, episodeAvailabilities } from '../schema/availabilities.js'

let genreId: string
let movieId: string
let seriesId: string
let seasonId: string
let episodeId: string

const testRowIds: { table: string; id: string }[] = []

beforeAll(async () => {
  const [genre] = await db
    .insert(genres)
    .values({ name: 'Action', slug: 'action-test' })
    .returning()
  genreId = genre.id

  const [movie] = await db
    .insert(movies)
    .values({ title: 'Test Movie' })
    .returning()
  movieId = movie.id

  const [s] = await db
    .insert(series)
    .values({ title: 'Test Series' })
    .returning()
  seriesId = s.id

  const [season] = await db
    .insert(seasons)
    .values({ seriesId, seasonNumber: 1 })
    .returning()
  seasonId = season.id

  const [episode] = await db
    .insert(episodes)
    .values({ seasonId, seriesId, episodeNumber: 1 })
    .returning()
  episodeId = episode.id
})

afterAll(async () => {
  await db.delete(episodes).where(eq(episodes.id, episodeId))
  await db.delete(seasons).where(eq(seasons.id, seasonId))
  await db.delete(series).where(eq(series.id, seriesId))
  await db.delete(movies).where(eq(movies.id, movieId))
  await db.delete(genres).where(eq(genres.id, genreId))
})

afterEach(async () => {
  for (const row of testRowIds.splice(0)) {
    if (row.table === 'seasons') {
      await db.delete(seasons).where(eq(seasons.id, row.id))
    } else if (row.table === 'episodes') {
      await db.delete(episodes).where(eq(episodes.id, row.id))
    } else if (row.table === 'movie_availabilities') {
      await db.delete(movieAvailabilities).where(eq(movieAvailabilities.id, row.id))
    } else if (row.table === 'episode_availabilities') {
      await db.delete(episodeAvailabilities).where(eq(episodeAvailabilities.id, row.id))
    }
  }
})

describe('catalog domain constraints', () => {
  it('rejects duplicate (series_id, season_number)', async () => {
    const [inserted] = await db
      .insert(seasons)
      .values({ seriesId, seasonNumber: 99 })
      .returning()
    testRowIds.push({ table: 'seasons', id: inserted.id })

    await expect(
      db.insert(seasons).values({ seriesId, seasonNumber: 99 }),
    ).rejects.toThrow()
  })

  it('rejects duplicate (season_id, episode_number)', async () => {
    const [inserted] = await db
      .insert(episodes)
      .values({ seasonId, seriesId, episodeNumber: 99 })
      .returning()
    testRowIds.push({ table: 'episodes', id: inserted.id })

    await expect(
      db.insert(episodes).values({ seasonId, seriesId, episodeNumber: 99 }),
    ).rejects.toThrow()
  })

  it('rejects duplicate (movie_id, provider_id, provider_item_id) in movie_availabilities', async () => {
    const now = new Date()
    const [inserted] = await db
      .insert(movieAvailabilities)
      .values({
        movieId,
        providerId: 'xtream:server1',
        providerItemId: 'item-42',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'movie_availabilities', id: inserted.id })

    await expect(
      db.insert(movieAvailabilities).values({
        movieId,
        providerId: 'xtream:server1',
        providerItemId: 'item-42',
        firstSeenAt: now,
        lastSeenAt: now,
      }),
    ).rejects.toThrow()
  })

  it('preserves first_seen_at when only last_seen_at is updated', async () => {
    const firstSeen = new Date('2026-01-01T00:00:00Z')
    const lastSeen = new Date('2026-06-01T00:00:00Z')

    const [inserted] = await db
      .insert(movieAvailabilities)
      .values({
        movieId,
        providerId: 'xtream:server2',
        providerItemId: 'item-preserve',
        firstSeenAt: firstSeen,
        lastSeenAt: firstSeen,
      })
      .returning()
    testRowIds.push({ table: 'movie_availabilities', id: inserted.id })

    await db
      .update(movieAvailabilities)
      .set({ lastSeenAt: lastSeen })
      .where(eq(movieAvailabilities.id, inserted.id))

    const [row] = await db
      .select()
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.id, inserted.id))

    expect(row.firstSeenAt.toISOString()).toBe(firstSeen.toISOString())
    expect(row.lastSeenAt.toISOString()).toBe(lastSeen.toISOString())
  })

  it('allows one movie to have availabilities on multiple sources', async () => {
    const now = new Date()

    const [row1] = await db
      .insert(movieAvailabilities)
      .values({
        movieId,
        providerId: 'xtream:source-a',
        providerItemId: 'item-multi',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'movie_availabilities', id: row1.id })

    const [row2] = await db
      .insert(movieAvailabilities)
      .values({
        movieId,
        providerId: 'xtream:source-b',
        providerItemId: 'item-multi',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'movie_availabilities', id: row2.id })

    const rows = await db
      .select()
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, movieId))

    const providerIds = rows.map((r) => r.providerId)
    expect(providerIds).toContain('xtream:source-a')
    expect(providerIds).toContain('xtream:source-b')
  })

  it('rejects duplicate (episode_id, provider_id, provider_item_id) in episode_availabilities', async () => {
    const now = new Date()
    const [inserted] = await db
      .insert(episodeAvailabilities)
      .values({
        episodeId,
        providerId: 'xtream:server1',
        providerItemId: 'ep-42',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'episode_availabilities', id: inserted.id })

    await expect(
      db.insert(episodeAvailabilities).values({
        episodeId,
        providerId: 'xtream:server1',
        providerItemId: 'ep-42',
        firstSeenAt: now,
        lastSeenAt: now,
      }),
    ).rejects.toThrow()
  })

  it('rejects same (provider_id, provider_item_id) across two different episodes in episode_availabilities', async () => {
    const now = new Date()

    const [season2] = await db
      .insert(seasons)
      .values({ seriesId, seasonNumber: 2 })
      .returning()
    testRowIds.push({ table: 'seasons', id: season2.id })

    const [episodeB] = await db
      .insert(episodes)
      .values({ seasonId: season2.id, seriesId, episodeNumber: 1 })
      .returning()
    testRowIds.push({ table: 'episodes', id: episodeB.id })

    const [row] = await db
      .insert(episodeAvailabilities)
      .values({
        episodeId,
        providerId: 'xtream:server1',
        providerItemId: 'ep-cross-42',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'episode_availabilities', id: row.id })

    await expect(
      db.insert(episodeAvailabilities).values({
        episodeId: episodeB.id,
        providerId: 'xtream:server1',
        providerItemId: 'ep-cross-42',
        firstSeenAt: now,
        lastSeenAt: now,
      }),
    ).rejects.toThrow()
  })

  it('allows multiple distinct provider items to map to the same canonical episode', async () => {
    const now = new Date()

    const [row1] = await db
      .insert(episodeAvailabilities)
      .values({
        episodeId,
        providerId: 'xtream:server1',
        providerItemId: 'ep-multi-1',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'episode_availabilities', id: row1.id })

    const [row2] = await db
      .insert(episodeAvailabilities)
      .values({
        episodeId,
        providerId: 'xtream:server2',
        providerItemId: 'ep-multi-1',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'episode_availabilities', id: row2.id })

    expect(row1.episodeId).toBe(episodeId)
    expect(row2.episodeId).toBe(episodeId)
    expect(row1.providerId).not.toBe(row2.providerId)
  })

  it('canonical movie exists and is retrievable with zero availability rows', async () => {
    const rows = await db
      .select()
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, movieId))

    // The test movie created in beforeAll has no availability rows — it exists independently
    expect(rows.length).toBe(0)

    const [movie] = await db.select().from(movies).where(eq(movies.id, movieId))
    expect(movie).toBeDefined()
    expect(movie.id).toBe(movieId)
  })

  it('episode availability status defaults to AVAILABLE and accepts UNAVAILABLE', async () => {
    const now = new Date()
    const [inserted] = await db
      .insert(episodeAvailabilities)
      .values({
        episodeId,
        providerId: 'xtream:status-test',
        providerItemId: 'ep-status-1',
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning()
    testRowIds.push({ table: 'episode_availabilities', id: inserted.id })

    expect(inserted.status).toBe('AVAILABLE')
    expect(inserted.unavailableAt).toBeNull()

    await db
      .update(episodeAvailabilities)
      .set({ status: 'UNAVAILABLE', unavailableAt: now })
      .where(eq(episodeAvailabilities.id, inserted.id))

    const [updated] = await db
      .select()
      .from(episodeAvailabilities)
      .where(eq(episodeAvailabilities.id, inserted.id))

    expect(updated.status).toBe('UNAVAILABLE')
    expect(updated.unavailableAt).not.toBeNull()
  })
})
