import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { and, eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { movies } from '../../db/schema/movies.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { sources } from '../../db/schema/sources.js'
import { profiles } from '../../db/schema/profiles.js'
import { followRelease, releaseEvents } from '../../db/schema/release-lifecycle.js'
import { mediaArrivals } from '../../db/schema/arrivals.js'
import { recordArrivalsForFollowers, listArrivals, markRead } from '../arrival-service.js'
import { follow } from '../follow-release-service.js'
import { recordReleaseEvent } from '../release-lifecycle-service.js'

let profileId: string
let profile2Id: string
let movieId: string
let seriesId: string
let sourceId: string
let firstEventId: string

beforeAll(async () => {
  const [profile] = await db.insert(profiles).values({ name: 'Arrival Test Profile' }).returning()
  profileId = profile.id

  const [profile2] = await db.insert(profiles).values({ name: 'Arrival Test Profile 2' }).returning()
  profile2Id = profile2.id

  const [movie] = await db.insert(movies).values({ title: 'Arrival Test Movie' }).returning()
  movieId = movie.id

  const [serie] = await db.insert(seriesTable).values({ title: 'Arrival Test Series' }).returning()
  seriesId = serie.id

  const [source] = await db
    .insert(sources)
    .values({
      name: 'Arrival Test Source',
      type: 'XTREAM',
      baseUrl: 'http://test.arrival.example.com',
      username: 'u',
      password: 'p',
    })
    .returning()
  sourceId = source.id
})

afterAll(async () => {
  await db.delete(mediaArrivals).where(eq(mediaArrivals.profileId, profileId))
  await db.delete(mediaArrivals).where(eq(mediaArrivals.profileId, profile2Id))
  await db.delete(followRelease).where(eq(followRelease.profileId, profileId))
  await db.delete(followRelease).where(eq(followRelease.profileId, profile2Id))
  await db.delete(releaseEvents).where(eq(releaseEvents.mediaId, movieId))
  await db.delete(releaseEvents).where(eq(releaseEvents.mediaId, seriesId))
  await db.delete(movies).where(eq(movies.id, movieId))
  await db.delete(seriesTable).where(eq(seriesTable.id, seriesId))
  await db.delete(sources).where(eq(sources.id, sourceId))
  await db.delete(profiles).where(eq(profiles.id, profileId))
  await db.delete(profiles).where(eq(profiles.id, profile2Id))
})

describe('recordArrivalsForFollowers', () => {
  it('creates one arrival per following profile for a followed movie', async () => {
    await follow(profileId, 'MOVIE', movieId)
    await follow(profile2Id, 'MOVIE', movieId)

    const occurredAt = new Date('2025-02-01T10:00:00Z')
    const [event] = await db
      .insert(releaseEvents)
      .values({ mediaType: 'MOVIE', mediaId: movieId, eventType: 'SOURCE_APPEARED', occurredAt, sourceId })
      .returning()
    firstEventId = event.id

    await recordArrivalsForFollowers('MOVIE', movieId, sourceId, event.id, occurredAt)

    const arrivals = await db.select().from(mediaArrivals).where(eq(mediaArrivals.releaseEventId, event.id))
    expect(arrivals).toHaveLength(2)
    const pids = arrivals.map((a) => a.profileId).sort()
    expect(pids).toEqual([profileId, profile2Id].sort())
  })

  it('is idempotent — repeated call with same releaseEventId produces no duplicates', async () => {
    const [event] = await db
      .select()
      .from(releaseEvents)
      .where(eq(releaseEvents.id, firstEventId))
    await recordArrivalsForFollowers('MOVIE', movieId, sourceId, event.id, event.occurredAt)

    const arrivals = await db.select().from(mediaArrivals).where(eq(mediaArrivals.releaseEventId, firstEventId))
    expect(arrivals).toHaveLength(2)
  })

  it('creates no arrivals for media not followed by any profile', async () => {
    const occurredAt = new Date('2025-02-01T11:00:00Z')
    const [event] = await db
      .insert(releaseEvents)
      .values({ mediaType: 'SERIES', mediaId: seriesId, eventType: 'SOURCE_APPEARED', occurredAt, sourceId })
      .returning()

    await recordArrivalsForFollowers('SERIES', seriesId, sourceId, event.id, occurredAt)

    const arrivals = await db.select().from(mediaArrivals).where(eq(mediaArrivals.releaseEventId, event.id))
    expect(arrivals).toHaveLength(0)
  })
})

describe('listArrivals', () => {
  it('returns arrivals with mediaTitle, sourceName and no readAt', async () => {
    const arrivals = await listArrivals(profileId, 'unread')
    expect(arrivals.length).toBeGreaterThan(0)
    const first = arrivals[0]
    expect(first.mediaTitle).toBe('Arrival Test Movie')
    expect(first.sourceName).toBe('Arrival Test Source')
    expect(first.readAt).toBeNull()
  })

  it('returns all arrivals (including read) when filter is all', async () => {
    const all = await listArrivals(profileId, 'all')
    expect(all.length).toBeGreaterThan(0)
  })
})

describe('markRead', () => {
  it('sets readAt and removes item from unread list', async () => {
    const unread = await listArrivals(profileId, 'unread')
    expect(unread.length).toBeGreaterThan(0)
    const arrivalId = unread[0].id

    await markRead(profileId, arrivalId)

    const stillUnread = await listArrivals(profileId, 'unread')
    expect(stillUnread.some((a) => a.id === arrivalId)).toBe(false)

    const all = await listArrivals(profileId, 'all')
    const marked = all.find((a) => a.id === arrivalId)
    expect(marked?.readAt).not.toBeNull()
  })

  it('throws NotFoundError when arrival does not belong to profile', async () => {
    await expect(markRead(profileId, '00000000-0000-0000-0000-000000000099')).rejects.toThrow('not found')
  })
})

describe('recordReleaseEvent SOURCE_APPEARED integration', () => {
  it('creates an arrival via recordReleaseEvent for a followed movie', async () => {
    await follow(profileId, 'MOVIE', movieId)

    const occurredAt = new Date('2025-08-01T00:00:00Z')
    await recordReleaseEvent('MOVIE', movieId, 'SOURCE_APPEARED', occurredAt, sourceId)

    const [event] = await db
      .select()
      .from(releaseEvents)
      .where(
        and(
          eq(releaseEvents.mediaId, movieId),
          eq(releaseEvents.eventType, 'SOURCE_APPEARED'),
          eq(releaseEvents.occurredAt, occurredAt),
        ),
      )

    const arrivals = await db.select().from(mediaArrivals).where(eq(mediaArrivals.releaseEventId, event.id))
    expect(arrivals.length).toBeGreaterThan(0)
    expect(arrivals[0].profileId).toBe(profileId)
  })

  it('does not create a duplicate arrival on repeated idempotent recordReleaseEvent', async () => {
    const occurredAt = new Date('2025-08-01T00:00:00Z')
    await recordReleaseEvent('MOVIE', movieId, 'SOURCE_APPEARED', occurredAt, sourceId)

    const [event] = await db
      .select()
      .from(releaseEvents)
      .where(
        and(
          eq(releaseEvents.mediaId, movieId),
          eq(releaseEvents.eventType, 'SOURCE_APPEARED'),
          eq(releaseEvents.occurredAt, occurredAt),
        ),
      )

    const arrivals = await db.select().from(mediaArrivals).where(eq(mediaArrivals.releaseEventId, event.id))
    expect(arrivals).toHaveLength(1)
  })

  it('SOURCE_DISAPPEARED then SOURCE_APPEARED produces a new arrival', async () => {
    const disappearedAt = new Date('2025-09-01T00:00:00Z')
    await recordReleaseEvent('MOVIE', movieId, 'SOURCE_DISAPPEARED', disappearedAt, sourceId)

    const reappearedAt = new Date('2025-10-01T00:00:00Z')
    await recordReleaseEvent('MOVIE', movieId, 'SOURCE_APPEARED', reappearedAt, sourceId)

    const [newEvent] = await db
      .select()
      .from(releaseEvents)
      .where(
        and(
          eq(releaseEvents.mediaId, movieId),
          eq(releaseEvents.eventType, 'SOURCE_APPEARED'),
          eq(releaseEvents.occurredAt, reappearedAt),
        ),
      )

    const arrivals = await db.select().from(mediaArrivals).where(eq(mediaArrivals.releaseEventId, newEvent.id))
    expect(arrivals).toHaveLength(1)
  })
})
