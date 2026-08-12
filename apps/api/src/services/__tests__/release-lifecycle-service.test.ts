import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { sources } from '../../db/schema/sources.js'
import { releaseEvents } from '../../db/schema/release-lifecycle.js'
import {
  upsertReleaseFields,
  recordReleaseEvent,
  getTimeline,
} from '../release-lifecycle-service.js'

let testMovieId: string
let testSourceId: string

beforeAll(async () => {
  const [source] = await db
    .insert(sources)
    .values({ name: 'RLS Test Source', type: 'XTREAM', baseUrl: 'http://test.rls.example.com', username: 'u', password: 'p' })
    .returning()
  testSourceId = source.id

  const [movie] = await db
    .insert(movies)
    .values({ title: 'RLS Test Movie' })
    .returning()
  testMovieId = movie.id
})

afterAll(async () => {
  await db.delete(releaseEvents).where(eq(releaseEvents.mediaId, testMovieId))
  await db.delete(movies).where(eq(movies.id, testMovieId))
  await db.delete(sources).where(eq(sources.id, testSourceId))
})

describe('upsertReleaseFields', () => {
  it('writes date fields to the movie row idempotently', async () => {
    await upsertReleaseFields('MOVIE', testMovieId, {
      theatricalReleaseDate: '2025-03-15',
      digitalReleaseDate: '2025-06-01',
    })

    const [row] = await db.select().from(movies).where(eq(movies.id, testMovieId))
    expect(row.theatricalReleaseDate).toBe('2025-03-15')
    expect(row.digitalReleaseDate).toBe('2025-06-01')

    // Second call with same values — no error, no duplicate
    await expect(
      upsertReleaseFields('MOVIE', testMovieId, {
        theatricalReleaseDate: '2025-03-15',
        digitalReleaseDate: '2025-06-01',
      }),
    ).resolves.toBeUndefined()

    const [row2] = await db.select().from(movies).where(eq(movies.id, testMovieId))
    expect(row2.theatricalReleaseDate).toBe('2025-03-15')
  })
})

describe('recordReleaseEvent', () => {
  it('inserts an event and is idempotent on duplicate', async () => {
    const occurredAt = new Date('2025-03-15T00:00:00Z')

    await recordReleaseEvent('MOVIE', testMovieId, 'THEATRICAL_RELEASE', occurredAt)
    await recordReleaseEvent('MOVIE', testMovieId, 'THEATRICAL_RELEASE', occurredAt) // duplicate — silent

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const theatrical = events.filter((e) => e.eventType === 'THEATRICAL_RELEASE')
    expect(theatrical).toHaveLength(1)
    expect(theatrical[0].occurredAt.toISOString()).toBe('2025-03-15T00:00:00.000Z')
  })

  it('records SOURCE_APPEARED with a sourceId', async () => {
    const occurredAt = new Date('2025-01-01T00:00:00Z')
    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_APPEARED', occurredAt, testSourceId)

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const appeared = events.find((e) => e.eventType === 'SOURCE_APPEARED')
    expect(appeared).toBeDefined()
    expect(appeared!.sourceId).toBe(testSourceId)
  })
})

describe('getTimeline', () => {
  it('returns events in chronological order with date fields', async () => {
    const timeline = await getTimeline('MOVIE', testMovieId)

    expect(timeline.theatricalReleaseDate).toBe('2025-03-15')
    expect(timeline.digitalReleaseDate).toBe('2025-06-01')
    expect(Array.isArray(timeline.timeline)).toBe(true)

    // Events should be in ascending occurredAt order
    const dates = timeline.timeline.map((e) => e.occurredAt)
    const sorted = [...dates].sort()
    expect(dates).toEqual(sorted)
  })

  it('returns empty timeline and null dates for a media with no events', async () => {
    const [fresh] = await db.insert(movies).values({ title: 'No Events Movie' }).returning()
    try {
      const timeline = await getTimeline('MOVIE', fresh.id)
      expect(timeline.announcedAt).toBeNull()
      expect(timeline.theatricalReleaseDate).toBeNull()
      expect(timeline.digitalReleaseDate).toBeNull()
      expect(timeline.timeline).toHaveLength(0)
    } finally {
      await db.delete(movies).where(eq(movies.id, fresh.id))
    }
  })
})
