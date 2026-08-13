import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { releaseEvents } from '../db/schema/release-lifecycle.js'
import type { ReleaseEventType, ReleaseLifecycle } from '@iptvflix/api-contracts'
import { recordArrivalsForFollowers } from './arrival-service.js'

export async function upsertReleaseFields(
  mediaType: 'MOVIE' | 'SERIES',
  mediaId: string,
  fields: {
    announcedAt?: string | null
    theatricalReleaseDate?: string | null
    digitalReleaseDate?: string | null
  },
): Promise<void> {
  if (Object.keys(fields).length === 0) return

  if (mediaType === 'MOVIE') {
    await db.update(movies).set(fields).where(eq(movies.id, mediaId))
  } else {
    await db.update(series).set(fields).where(eq(series.id, mediaId))
  }
}

export async function recordReleaseEvent(
  mediaType: 'MOVIE' | 'SERIES' | 'EPISODE',
  mediaId: string,
  eventType: ReleaseEventType,
  occurredAt: Date,
  sourceId?: string | null,
): Promise<void> {
  const inserted = await db
    .insert(releaseEvents)
    .values({ mediaType, mediaId, eventType, occurredAt, sourceId: sourceId ?? null })
    .onConflictDoNothing()
    .returning({ id: releaseEvents.id })

  if (
    inserted.length > 0 &&
    eventType === 'SOURCE_APPEARED' &&
    (mediaType === 'MOVIE' || mediaType === 'SERIES')
  ) {
    await recordArrivalsForFollowers(mediaType, mediaId, sourceId ?? null, inserted[0].id, occurredAt)
  }
}

export async function getTimeline(
  mediaType: 'MOVIE' | 'SERIES' | 'EPISODE',
  mediaId: string,
): Promise<ReleaseLifecycle> {
  const events = await db
    .select()
    .from(releaseEvents)
    .where(and(eq(releaseEvents.mediaType, mediaType), eq(releaseEvents.mediaId, mediaId)))
    .orderBy(asc(releaseEvents.occurredAt))

  let announcedAt: string | null = null
  let theatricalReleaseDate: string | null = null
  let digitalReleaseDate: string | null = null

  if (mediaType === 'MOVIE') {
    const [row] = await db
      .select({
        announcedAt: movies.announcedAt,
        theatricalReleaseDate: movies.theatricalReleaseDate,
        digitalReleaseDate: movies.digitalReleaseDate,
      })
      .from(movies)
      .where(eq(movies.id, mediaId))
    if (row) {
      announcedAt = row.announcedAt
      theatricalReleaseDate = row.theatricalReleaseDate
      digitalReleaseDate = row.digitalReleaseDate
    }
  } else if (mediaType === 'SERIES') {
    const [row] = await db
      .select({
        announcedAt: series.announcedAt,
        theatricalReleaseDate: series.theatricalReleaseDate,
        digitalReleaseDate: series.digitalReleaseDate,
      })
      .from(series)
      .where(eq(series.id, mediaId))
    if (row) {
      announcedAt = row.announcedAt
      theatricalReleaseDate = row.theatricalReleaseDate
      digitalReleaseDate = row.digitalReleaseDate
    }
  }
  // EPISODE: no release-date fields; announcedAt/theatricalReleaseDate/digitalReleaseDate remain null

  return {
    announcedAt,
    theatricalReleaseDate,
    digitalReleaseDate,
    timeline: events.map((e) => ({
      eventType: e.eventType,
      occurredAt: e.occurredAt.toISOString(),
      sourceId: e.sourceId,
    })),
  }
}
