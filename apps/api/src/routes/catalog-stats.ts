import type { FastifyInstance } from 'fastify'
import { count, isNotNull, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { episodes } from '../db/schema/episodes.js'
import {
  movieAvailabilities,
  seriesAvailabilities,
  episodeAvailabilities,
} from '../db/schema/availabilities.js'

export async function catalogStatsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/catalog-stats', async () => {
    const [
      movieStats,
      seriesStats,
      episodeCountRow,
      movieAvailRow,
      seriesAvailRow,
      episodeAvailRow,
      oldestMovieSync,
      oldestSeriesSync,
    ] = await Promise.all([
      db.select({
        total: count(),
        withAvailability: sql<number>`cast(count(*) filter (where exists (
          select 1 from movie_availabilities where movie_id = movies.id and status = 'AVAILABLE'
        )) as integer)`,
        upcoming: sql<number>`cast(count(*) filter (where status in (
          'Rumored','Planned','In Production','Post Production'
        )) as integer)`,
        enriched: sql<number>`cast(count(*) filter (where metadata_enriched_at is not null) as integer)`,
      }).from(movies),

      db.select({
        total: count(),
        withAvailability: sql<number>`cast(count(*) filter (where exists (
          select 1 from series_availabilities where series_id = series.id and status = 'AVAILABLE'
        )) as integer)`,
        upcoming: sql<number>`cast(count(*) filter (where status in (
          'In Production','Planned','Returning Series'
        )) as integer)`,
        enriched: sql<number>`cast(count(*) filter (where metadata_enriched_at is not null) as integer)`,
      }).from(series),

      db.select({ cnt: count() }).from(episodes),
      db.select({ cnt: count() }).from(movieAvailabilities),
      db.select({ cnt: count() }).from(seriesAvailabilities),
      db.select({ cnt: count() }).from(episodeAvailabilities),

      db
        .select({ syncedAt: sql<string | null>`min(tmdb_synced_at)::text` })
        .from(movies)
        .where(isNotNull(movies.tmdbSyncedAt)),

      db
        .select({ syncedAt: sql<string | null>`min(tmdb_synced_at)::text` })
        .from(series)
        .where(isNotNull(series.tmdbSyncedAt)),
    ])

    const mTotal = Number(movieStats[0]?.total ?? 0)
    const mWithAvail = Number(movieStats[0]?.withAvailability ?? 0)
    const sTotal = Number(seriesStats[0]?.total ?? 0)
    const sWithAvail = Number(seriesStats[0]?.withAvailability ?? 0)

    return {
      movies: {
        total: mTotal,
        withAvailability: mWithAvail,
        withoutAvailability: mTotal - mWithAvail,
        upcoming: Number(movieStats[0]?.upcoming ?? 0),
        enriched: Number(movieStats[0]?.enriched ?? 0),
        embeddingPending: 0,
      },
      series: {
        total: sTotal,
        withAvailability: sWithAvail,
        withoutAvailability: sTotal - sWithAvail,
        upcoming: Number(seriesStats[0]?.upcoming ?? 0),
        enriched: Number(seriesStats[0]?.enriched ?? 0),
        embeddingPending: 0,
      },
      episodeCount: Number(episodeCountRow[0]?.cnt ?? 0),
      availabilityRows: {
        movie: Number(movieAvailRow[0]?.cnt ?? 0),
        series: Number(seriesAvailRow[0]?.cnt ?? 0),
        episode: Number(episodeAvailRow[0]?.cnt ?? 0),
      },
      tmdbSyncAge: {
        oldestMovieSyncedAt: oldestMovieSync[0]?.syncedAt ?? null,
        oldestSeriesSyncedAt: oldestSeriesSync[0]?.syncedAt ?? null,
      },
    }
  })
}
