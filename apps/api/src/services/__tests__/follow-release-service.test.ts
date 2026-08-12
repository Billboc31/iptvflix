import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { profiles } from '../../db/schema/profiles.js'
import { watchlist } from '../../db/schema/watchlist.js'
import { followRelease } from '../../db/schema/release-lifecycle.js'
import { follow, unfollow, listFollowed, isFollowing } from '../follow-release-service.js'

let profileId: string
let movieId: string
let seriesId: string

beforeAll(async () => {
  const [profile] = await db
    .insert(profiles)
    .values({ name: 'Follow Test Profile' })
    .returning()
  profileId = profile.id

  const [movie] = await db.insert(movies).values({ title: 'Follow Test Movie' }).returning()
  movieId = movie.id

  const [serie] = await db.insert(seriesTable).values({ title: 'Follow Test Series' }).returning()
  seriesId = serie.id
})

afterAll(async () => {
  await db.delete(followRelease).where(eq(followRelease.profileId, profileId))
  await db.delete(watchlist).where(eq(watchlist.profileId, profileId))
  await db.delete(movies).where(eq(movies.id, movieId))
  await db.delete(seriesTable).where(eq(seriesTable.id, seriesId))
  await db.delete(profiles).where(eq(profiles.id, profileId))
})

describe('follow / unfollow round-trip', () => {
  it('follows a movie and lists it', async () => {
    const entry = await follow(profileId, 'MOVIE', movieId)
    expect(entry.mediaType).toBe('MOVIE')
    expect(entry.mediaId).toBe(movieId)
    expect(entry.profileId).toBe(profileId)

    const list = await listFollowed(profileId)
    expect(list.some((e) => e.mediaId === movieId)).toBe(true)
  })

  it('follow is idempotent — no error on duplicate', async () => {
    const entry1 = await follow(profileId, 'MOVIE', movieId)
    const entry2 = await follow(profileId, 'MOVIE', movieId)
    expect(entry1.id).toBe(entry2.id)
  })

  it('unfollow removes the entry', async () => {
    await unfollow(profileId, 'MOVIE', movieId)
    const following = await isFollowing(profileId, 'MOVIE', movieId)
    expect(following).toBe(false)
  })
})

describe('isFollowing', () => {
  it('returns false when only on watchlist (not follow-release)', async () => {
    await db.insert(watchlist).values({ profileId, mediaType: 'MOVIE', mediaId: movieId })
    const following = await isFollowing(profileId, 'MOVIE', movieId)
    expect(following).toBe(false)
  })

  it('returns true after following', async () => {
    await follow(profileId, 'MOVIE', movieId)
    const following = await isFollowing(profileId, 'MOVIE', movieId)
    expect(following).toBe(true)
    await unfollow(profileId, 'MOVIE', movieId)
  })
})

describe('series follow — series level only', () => {
  it('follows series without creating episode-level entries', async () => {
    const entry = await follow(profileId, 'SERIES', seriesId)
    expect(entry.mediaType).toBe('SERIES')
    expect(entry.mediaId).toBe(seriesId)

    // follow_release table has only one row for this profile+series
    const rows = await db
      .select()
      .from(followRelease)
      .where(eq(followRelease.profileId, profileId))
    const seriesRows = rows.filter((r) => r.mediaType === 'SERIES' && r.mediaId === seriesId)
    expect(seriesRows).toHaveLength(1)

    await unfollow(profileId, 'SERIES', seriesId)
  })
})
