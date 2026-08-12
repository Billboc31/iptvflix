import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
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
let testSourceId2: string

beforeAll(async () => {
  const [source] = await db
    .insert(sources)
    .values({ name: 'RLS Test Source', type: 'XTREAM', baseUrl: 'http://test.rls.example.com', username: 'u', password: 'p' })
    .returning()
  testSourceId = source.id

  const [source2] = await db
    .insert(sources)
    .values({ name: 'RLS Test Source 2', type: 'XTREAM', baseUrl: 'http://test2.rls.example.com', username: 'u', password: 'p' })
    .returning()
  testSourceId2 = source2.id

  const [movie] = await db
    .insert(movies)
    .values({ title: 'RLS Test Movie' })
    .returning()
  testMovieId = movie.id
})

afterAll(async () => {
  await db.delete(releaseEvents).where(eq(releaseEvents.mediaId, testMovieId))
  await db.delete(movies).where(eq(movies.id, testMovieId))
  await db.delete(sources).where(inArray(sources.id, [testSourceId, testSourceId2]))
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

describe('source-aware idempotency', () => {
  it('allows two different sources to record SOURCE_APPEARED at the same timestamp', async () => {
    const occurredAt = new Date('2025-06-01T00:00:00Z')

    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_APPEARED', occurredAt, testSourceId)
    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_APPEARED', occurredAt, testSourceId2)

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const appeared = events.filter(
      (e) => e.eventType === 'SOURCE_APPEARED' && e.occurredAt.toISOString() === occurredAt.toISOString(),
    )
    expect(appeared).toHaveLength(2)
    const sourceIds = appeared.map((e) => e.sourceId).sort()
    expect(sourceIds).toEqual([testSourceId, testSourceId2].sort())
  })

  it('is idempotent when the same source re-inserts SOURCE_APPEARED at the same timestamp', async () => {
    const occurredAt = new Date('2025-06-01T00:00:00Z')

    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_APPEARED', occurredAt, testSourceId)

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const appeared = events.filter(
      (e) =>
        e.eventType === 'SOURCE_APPEARED' &&
        e.sourceId === testSourceId &&
        e.occurredAt.toISOString() === occurredAt.toISOString(),
    )
    expect(appeared).toHaveLength(1)
  })

  it('allows two different sources to record SOURCE_DISAPPEARED at the same timestamp', async () => {
    const occurredAt = new Date('2025-07-01T00:00:00Z')

    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_DISAPPEARED', occurredAt, testSourceId)
    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_DISAPPEARED', occurredAt, testSourceId2)

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const disappeared = events.filter(
      (e) => e.eventType === 'SOURCE_DISAPPEARED' && e.occurredAt.toISOString() === occurredAt.toISOString(),
    )
    expect(disappeared).toHaveLength(2)
  })

  it('is idempotent when the same source re-inserts SOURCE_DISAPPEARED at the same timestamp', async () => {
    const occurredAt = new Date('2025-07-01T00:00:00Z')

    await recordReleaseEvent('MOVIE', testMovieId, 'SOURCE_DISAPPEARED', occurredAt, testSourceId)

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const disappeared = events.filter(
      (e) =>
        e.eventType === 'SOURCE_DISAPPEARED' &&
        e.sourceId === testSourceId &&
        e.occurredAt.toISOString() === occurredAt.toISOString(),
    )
    expect(disappeared).toHaveLength(1)
  })

  it('retains idempotency for non-source events (ANNOUNCED)', async () => {
    const occurredAt = new Date('2024-01-01T00:00:00Z')

    await recordReleaseEvent('MOVIE', testMovieId, 'ANNOUNCED', occurredAt)
    await recordReleaseEvent('MOVIE', testMovieId, 'ANNOUNCED', occurredAt)

    const events = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.mediaId, testMovieId))

    const announced = events.filter(
      (e) => e.eventType === 'ANNOUNCED' && e.occurredAt.toISOString() === occurredAt.toISOString(),
    )
    expect(announced).toHaveLength(1)
  })
})
