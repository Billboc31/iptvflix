import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { and, eq, desc, inArray, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { viewingProgress, movies, episodes, series } from '../db/schema/index.js'
import { NotFoundError } from '../errors.js'
import type { ProgressMediaType, ViewingProgressRow, ContinueWatchingItem } from '@iptvflix/api-contracts'

// State thresholds:
// Never started:   progressSeconds / durationSeconds < 0.05
// In progress:     0.05 <= progressSeconds / durationSeconds < 0.90
// Completed:       progressSeconds / durationSeconds >= 0.90
// Only "in progress" items appear in Continue Watching.

type ProgressRow = typeof viewingProgress.$inferSelect

function toRow(row: ProgressRow): ViewingProgressRow {
  return {
    id: row.id,
    profileId: row.profileId,
    mediaType: row.mediaType as ProgressMediaType,
    mediaId: row.mediaId,
    progressSeconds: row.progressSeconds,
    durationSeconds: row.durationSeconds,
    lastWatchedAt: row.lastWatchedAt.toISOString(),
  }
}

async function validateMediaId(mediaType: ProgressMediaType, mediaId: string): Promise<void> {
  if (mediaType === 'MOVIE') {
    const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, mediaId))
    if (!row) throw new NotFoundError('Movie', mediaId)
  } else {
    const [row] = await db.select({ id: episodes.id }).from(episodes).where(eq(episodes.id, mediaId))
    if (!row) throw new NotFoundError('Episode', mediaId)
  }
}

export async function upsertProgress(
  profileId: string,
  mediaType: ProgressMediaType,
  mediaId: string,
  progressSeconds: number,
  durationSeconds: number,
): Promise<ViewingProgressRow> {
  await validateMediaId(mediaType, mediaId)

  const now = new Date()
  const [row] = await db
    .insert(viewingProgress)
    .values({ profileId, mediaType, mediaId, progressSeconds, durationSeconds, lastWatchedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [viewingProgress.profileId, viewingProgress.mediaType, viewingProgress.mediaId],
      set: { progressSeconds, durationSeconds, lastWatchedAt: now, updatedAt: now },
    })
    .returning()

  return toRow(row)
}

export async function listContinueWatching(profileId: string): Promise<ContinueWatchingItem[]> {
  const rows = await db
    .select()
    .from(viewingProgress)
    .where(
      and(
        eq(viewingProgress.profileId, profileId),
        sql`${viewingProgress.progressSeconds} >= ${viewingProgress.durationSeconds} * 0.05`,
        sql`${viewingProgress.progressSeconds} < ${viewingProgress.durationSeconds} * 0.90`,
      ),
    )
    .orderBy(desc(viewingProgress.lastWatchedAt))

  if (rows.length === 0) return []

  const movieIds = rows.filter((r) => r.mediaType === 'MOVIE').map((r) => r.mediaId)
  const episodeIds = rows.filter((r) => r.mediaType === 'EPISODE').map((r) => r.mediaId)

  const [movieMeta, episodeRows] = await Promise.all([
    movieIds.length > 0
      ? db
          .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
          .from(movies)
          .where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    episodeIds.length > 0
      ? db
          .select({ id: episodes.id, seriesId: episodes.seriesId })
          .from(episodes)
          .where(inArray(episodes.id, episodeIds))
      : Promise.resolve([]),
  ])

  const movieMap = new Map(movieMeta.map((m) => [m.id, m]))

  // For episodes, look up the parent series for title and posterPath
  const seriesIds = [...new Set(episodeRows.map((e) => e.seriesId))]
  const seriesMeta = seriesIds.length > 0
    ? await db
        .select({ id: series.id, title: series.title, posterPath: series.posterPath })
        .from(series)
        .where(inArray(series.id, seriesIds))
    : []
  const seriesMap = new Map(seriesMeta.map((s) => [s.id, s]))
  const episodeSeriesMap = new Map(episodeRows.map((e) => [e.id, seriesMap.get(e.seriesId)]))

  return rows.map((row) => {
    const base = toRow(row)
    if (row.mediaType === 'MOVIE') {
      const meta = movieMap.get(row.mediaId)
      return { ...base, title: meta?.title ?? row.mediaId, posterUrl: resolveMediaImageUrl(meta?.posterPath) }
    } else {
      const meta = episodeSeriesMap.get(row.mediaId)
      return { ...base, title: meta?.title ?? row.mediaId, posterUrl: resolveMediaImageUrl(meta?.posterPath) }
    }
  })
}
