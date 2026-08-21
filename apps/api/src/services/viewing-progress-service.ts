import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { and, eq, desc, inArray, sql, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { viewingProgress, movies, episodes, seasons, series, continueWatchingDismissals } from '../db/schema/index.js'
import { NotFoundError } from '../errors.js'
import type { ProgressMediaType, ViewingProgressRow, ContinueWatchingItem } from '@iptvflix/api-contracts'

// Continue Watching eligibility:
// Started:   progressSeconds >= CW_MIN_PROGRESS_SECONDS (2s)
// Completed: durationSeconds >= 600 AND progress >= 90% of duration
//            (short/bogus IPTV durations must NOT hide titles from CW)
//
// Historically we used a pure 5%–90% ratio window; after "next episode" + flaky
// Exo durations, titles vanished from Continuer à regarder.

export const CW_MIN_PROGRESS_SECONDS = 2
export const CW_COMPLETED_RATIO = 0.9
/** Durations below this are treated as unreliable for "completed" detection. */
export const CW_MIN_CREDIBLE_DURATION_SECONDS = 600

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
  // HLS/IPTV often reports a fragment duration much shorter than the title.
  // Never shrink a longer duration already stored, otherwise a 10s playlist
  // "ended" event would mark the title complete and drop it from Continue Watching.
  const [row] = await db
    .insert(viewingProgress)
    .values({ profileId, mediaType, mediaId, progressSeconds, durationSeconds, lastWatchedAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [viewingProgress.profileId, viewingProgress.mediaType, viewingProgress.mediaId],
      set: {
        durationSeconds: sql`GREATEST(${viewingProgress.durationSeconds}, EXCLUDED.duration_seconds)`,
        progressSeconds: sql`LEAST(${progressSeconds}, GREATEST(${viewingProgress.durationSeconds}, EXCLUDED.duration_seconds))`,
        lastWatchedAt: now,
        updatedAt: now,
      },
    })
    .returning()

  // Clear dismissal once the item is eligible for Continue Watching again.
  if (row.progressSeconds >= CW_MIN_PROGRESS_SECONDS) {
    try {
      await db
        .delete(continueWatchingDismissals)
        .where(
          and(
            eq(continueWatchingDismissals.profileId, profileId),
            eq(continueWatchingDismissals.mediaType, mediaType),
            eq(continueWatchingDismissals.mediaId, mediaId),
          ),
        )
    } catch (err) {
      console.error('[continue-watching] could not clear dismissal (table may be missing):', err)
    }
  }

  return toRow(row)
}

export async function dismissContinueWatching(
  profileId: string,
  mediaType: ProgressMediaType,
  mediaId: string,
): Promise<void> {
  await db
    .insert(continueWatchingDismissals)
    .values({ profileId, mediaType, mediaId })
    .onConflictDoUpdate({
      target: [continueWatchingDismissals.profileId, continueWatchingDismissals.mediaType, continueWatchingDismissals.mediaId],
      set: { dismissedAt: new Date() },
    })
}

export async function listContinueWatching(profileId: string): Promise<ContinueWatchingItem[]> {
  const progressSelect = {
    id: viewingProgress.id,
    profileId: viewingProgress.profileId,
    mediaType: viewingProgress.mediaType,
    mediaId: viewingProgress.mediaId,
    progressSeconds: viewingProgress.progressSeconds,
    durationSeconds: viewingProgress.durationSeconds,
    lastWatchedAt: viewingProgress.lastWatchedAt,
    updatedAt: viewingProgress.updatedAt,
  }
  const inProgress = and(
    eq(viewingProgress.profileId, profileId),
    // Started (≥2s). Exclude only *credible* completions: long enough title + ≥90%.
    // Short/bogus IPTV durations (e.g. 2s fragment) used to mark titles complete and empty CW.
    sql`${viewingProgress.progressSeconds} >= ${CW_MIN_PROGRESS_SECONDS}`,
    sql`not (
      ${viewingProgress.durationSeconds} >= 600
      and ${viewingProgress.progressSeconds} >= ${viewingProgress.durationSeconds} * 0.90
    )`,
  )

  let rows: Array<{
    id: string
    profileId: string
    mediaType: string
    mediaId: string
    progressSeconds: number
    durationSeconds: number
    lastWatchedAt: Date
    updatedAt: Date
  }>
  try {
    rows = await db
      .select(progressSelect)
      .from(viewingProgress)
      .leftJoin(
        continueWatchingDismissals,
        and(
          eq(continueWatchingDismissals.profileId, viewingProgress.profileId),
          eq(continueWatchingDismissals.mediaType, viewingProgress.mediaType),
          eq(continueWatchingDismissals.mediaId, viewingProgress.mediaId),
        ),
      )
      .where(and(inProgress, isNull(continueWatchingDismissals.id)))
      .orderBy(desc(viewingProgress.lastWatchedAt))
  } catch (err) {
    console.error('[continue-watching] dismissals join failed, listing without dismissals:', err)
    rows = await db
      .select(progressSelect)
      .from(viewingProgress)
      .where(inProgress)
      .orderBy(desc(viewingProgress.lastWatchedAt))
  }

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
          .select({
            id: episodes.id,
            seriesId: episodes.seriesId,
            episodeNumber: episodes.episodeNumber,
            title: episodes.title,
            seasonNumber: seasons.seasonNumber,
          })
          .from(episodes)
          .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
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
  const episodeMap = new Map(episodeRows.map((e) => [e.id, e]))

  return rows.map((row) => {
    const base: ViewingProgressRow = {
      id: row.id,
      profileId: row.profileId,
      mediaType: row.mediaType as ProgressMediaType,
      mediaId: row.mediaId,
      progressSeconds: row.progressSeconds,
      durationSeconds: row.durationSeconds,
      lastWatchedAt: row.lastWatchedAt.toISOString(),
    }
    if (row.mediaType === 'MOVIE') {
      const meta = movieMap.get(row.mediaId)
      return {
        ...base,
        title: meta?.title ?? row.mediaId,
        posterUrl: resolveMediaImageUrl(meta?.posterPath),
        seriesId: null,
        seasonNumber: null,
        episodeNumber: null,
        episodeTitle: null,
      }
    } else {
      const ep = episodeMap.get(row.mediaId)
      const ser = ep ? seriesMap.get(ep.seriesId) : undefined
      return {
        ...base,
        title: ser?.title ?? row.mediaId,
        posterUrl: resolveMediaImageUrl(ser?.posterPath),
        seriesId: ep?.seriesId ?? null,
        seasonNumber: ep?.seasonNumber ?? null,
        episodeNumber: ep?.episodeNumber ?? null,
        episodeTitle: ep?.title ?? null,
      }
    }
  })
}
