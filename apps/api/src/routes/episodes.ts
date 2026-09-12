import type { FastifyInstance } from 'fastify'
import { eq, lt, and, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { episodes } from '../db/schema/episodes.js'
import { seasons } from '../db/schema/seasons.js'
import { series as seriesTable } from '../db/schema/series.js'
import { segmentSelections } from '../db/schema/segment-selections.js'
import { getPlaybackSegments, validSegment } from '../services/playback-segments.js'
import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import type { EpisodeContextResponse, EpisodeSegmentsResponse } from '@iptvflix/api-contracts'

function displayEpisodeTitle(title: string | null | undefined): string | null {
  if (title == null) return null
  const trimmed = title.trim()
  if (!trimmed) return null
  if (/^S\d{1,2}E\d{1,3}$/i.test(trimmed)) return null
  return trimmed
}

export async function episodeSegmentsRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string }; Querystring: { durationSeconds?: string } }>('/movies/:id/segments', async (request, reply) => {
    const durationSeconds = request.query.durationSeconds == null ? undefined : Number(request.query.durationSeconds)
    if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86400)) return reply.status(400).send({ error: 'Invalid durationSeconds' })
    const [movie] = await db.select({ id: movies.id, imdbId: sql<string | null>`coalesce(${movies.imdbId}, ${movies.externalIds}->>'imdb_id')` }).from(movies).where(eq(movies.id, request.params.id)).limit(1)
    if (!movie) return reply.status(404).send({ error: 'Movie not found' })
    const segments = await getPlaybackSegments({ mediaType: 'movie', episodeId: movie.id, seriesTmdbId: null, seriesImdbId: movie.imdbId, seasonNumber: 0, episodeNumber: 0, durationSeconds })
    return { mediaId: movie.id, segments }
  })
  app.get<{ Params: { id: string } }>('/episodes/:id', async (request, reply) => {
    const { id } = request.params

    const [row] = await db
      .select({
        id: episodes.id,
        seriesId: episodes.seriesId,
        seasonNumber: seasons.seasonNumber,
        episodeNumber: episodes.episodeNumber,
        title: episodes.title,
        posterPath: episodes.posterPath,
        seasonPosterPath: seasons.posterPath,
        seriesPosterPath: seriesTable.posterPath,
      })
      .from(episodes)
      .innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(seriesTable, eq(seriesTable.id, episodes.seriesId))
      .where(eq(episodes.id, id))
      .limit(1)

    if (!row) {
      return reply.status(404).send({ error: 'Episode not found' })
    }

    const response: EpisodeContextResponse = {
      id: row.id,
      seriesId: row.seriesId,
      seasonNumber: row.seasonNumber,
      episodeNumber: row.episodeNumber,
      title: displayEpisodeTitle(row.title),
      posterUrl: resolveMediaImageUrl(row.posterPath ?? row.seasonPosterPath ?? row.seriesPosterPath),
    }
    return reply.send(response)
  })

  app.get<{ Params: { id: string }; Querystring: { durationSeconds?: string } }>('/episodes/:id/segments', async (request, reply) => {
    const { id } = request.params

    const durationSeconds = request.query.durationSeconds == null ? undefined : Number(request.query.durationSeconds)
    if (durationSeconds !== undefined && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 86400)) {
      return reply.status(400).send({ error: 'Invalid durationSeconds' })
    }
    const [episode] = await db.select({
      episodeId: episodes.id, seriesTmdbId: seriesTable.tmdbId, seriesImdbId: sql<string | null>`coalesce(${seriesTable.imdbId}, ${seriesTable.externalIds}->>'imdb_id')`,
      seasonNumber: seasons.seasonNumber, episodeNumber: episodes.episodeNumber, seriesId: episodes.seriesId,
    }).from(episodes).innerJoin(seasons, eq(seasons.id, episodes.seasonId))
      .innerJoin(seriesTable, eq(seriesTable.id, episodes.seriesId)).where(eq(episodes.id, id)).limit(1)
    if (!episode) return reply.status(404).send({ error: 'Episode not found' })
    const prior = await db.select({ number: seasons.seasonNumber, count: seasons.episodeCount }).from(seasons)
      .where(and(eq(seasons.seriesId, episode.seriesId), lt(seasons.seasonNumber, episode.seasonNumber)))
    const regular = prior.filter((s) => s.number > 0).sort((a, b) => a.number - b.number)
    const complete = regular.length === episode.seasonNumber - 1 && regular.every((s, i) => s.number === i + 1 && s.count != null && s.count > 0)
    const online = await getPlaybackSegments({ ...episode, durationSeconds,
      absoluteEpisodeNumber: complete ? regular.reduce((sum, s) => sum + s.count!, episode.episodeNumber) : undefined,
    })
    const rows = await db
      .select({
        type: segmentSelections.type,
        startMs: segmentSelections.startMs,
        endMs: segmentSelections.endMs,
      })
      .from(segmentSelections)
      .where(eq(segmentSelections.episodeId, id))
      .orderBy(segmentSelections.startMs)

    const response: EpisodeSegmentsResponse = {
      episodeId: id,
      segments: [...online, ...rows.filter((r) => validSegment(r, durationSeconds) && !online.some((s) => (s.type === 'OUTRO' ? 'CREDITS' : s.type) === (r.type === 'OUTRO' ? 'CREDITS' : r.type)))
        .map((r) => ({ type: r.type, startMs: r.startMs, endMs: r.endMs, autoSkipSafe: false, source: 'Catalogue' }))]
        .sort((a, b) => a.startMs - b.startMs),
    }

    return reply.send(response)
  })
}
