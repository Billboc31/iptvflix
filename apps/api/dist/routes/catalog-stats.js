import { count, isNotNull, sql } from 'drizzle-orm';
import { EMBEDDING_ELIGIBLE_SQL_PREDICATE } from '../services/embedding-eligibility.js';
import { db } from '../db/client.js';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { episodes } from '../db/schema/episodes.js';
import { movieAvailabilities, seriesAvailabilities, episodeAvailabilities, } from '../db/schema/availabilities.js';
import { enrichmentFailures } from '../db/schema/enrichment-failures.js';
const STALE_DAYS = 30;
export async function catalogStatsRoutes(app) {
    app.get('/admin/catalog-stats', async () => {
        const staleThreshold = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString();
        const [movieStats, seriesStats, episodeCountRow, movieAvailRow, seriesAvailRow, episodeAvailRow, oldestMovieSync, oldestSeriesSync, movieFailureCount, seriesFailureCount, movieEmbeddingCount, seriesEmbeddingCount,] = await Promise.all([
            db.select({
                total: count(),
                withAvailability: sql `cast(count(*) filter (where exists (
          select 1 from movie_availabilities where movie_id = movies.id and status = 'AVAILABLE'
        )) as integer)`,
                upcoming: sql `cast(count(*) filter (where status in (
          'Rumored','Planned','In Production','Post Production'
        )) as integer)`,
                neverEnriched: sql `cast(count(*) filter (where metadata_enriched_at is null) as integer)`,
                // partiallyEnriched: enriched but missing synopsis or keywords (minimum narrative fields)
                partiallyEnriched: sql `cast(count(*) filter (
          where metadata_enriched_at is not null and (synopsis is null or keywords is null)
        ) as integer)`,
                // fullyEnriched: enriched with at least synopsis and keywords present (does not require all optional fields)
                fullyEnriched: sql `cast(count(*) filter (
          where metadata_enriched_at is not null and synopsis is not null and keywords is not null
        ) as integer)`,
                stale: sql `cast(count(*) filter (
          where metadata_enriched_at is not null and metadata_enriched_at < ${staleThreshold}
        ) as integer)`,
            }).from(movies),
            db.select({
                total: count(),
                withAvailability: sql `cast(count(*) filter (where exists (
          select 1 from series_availabilities where series_id = series.id and status = 'AVAILABLE'
        )) as integer)`,
                upcoming: sql `cast(count(*) filter (where status in (
          'In Production','Planned','Returning Series'
        )) as integer)`,
                neverEnriched: sql `cast(count(*) filter (where metadata_enriched_at is null) as integer)`,
                // partiallyEnriched: enriched but missing synopsis or keywords (minimum narrative fields)
                partiallyEnriched: sql `cast(count(*) filter (
          where metadata_enriched_at is not null and (synopsis is null or keywords is null)
        ) as integer)`,
                // fullyEnriched: enriched with at least synopsis and keywords present (does not require all optional fields)
                fullyEnriched: sql `cast(count(*) filter (
          where metadata_enriched_at is not null and synopsis is not null and keywords is not null
        ) as integer)`,
                stale: sql `cast(count(*) filter (
          where metadata_enriched_at is not null and metadata_enriched_at < ${staleThreshold}
        ) as integer)`,
            }).from(series),
            db.select({ cnt: count() }).from(episodes),
            db.select({ cnt: count() }).from(movieAvailabilities),
            db.select({ cnt: count() }).from(seriesAvailabilities),
            db.select({ cnt: count() }).from(episodeAvailabilities),
            db
                .select({ syncedAt: sql `min(tmdb_synced_at)::text` })
                .from(movies)
                .where(isNotNull(movies.tmdbSyncedAt)),
            db
                .select({ syncedAt: sql `min(tmdb_synced_at)::text` })
                .from(series)
                .where(isNotNull(series.tmdbSyncedAt)),
            db.select({ cnt: count() }).from(enrichmentFailures).where(sql `media_type = 'MOVIE'`),
            db.select({ cnt: count() }).from(enrichmentFailures).where(sql `media_type = 'SERIES'`),
            // Embedding eligible = enriched. Pending = enriched but no embedding row.
            // Eligibility condition is derived from EMBEDDING_ELIGIBLE_SQL_PREDICATE (see embedding-eligibility.ts).
            db.select({
                eligible: sql `cast(count(*) filter (where ${sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)}) as integer)`,
                pending: sql `cast(count(*) filter (
          where ${sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)} and not exists (
            select 1 from media_embeddings
            where media_id = movies.id and media_type = 'MOVIE'
          )
        ) as integer)`,
            }).from(movies),
            db.select({
                eligible: sql `cast(count(*) filter (where ${sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)}) as integer)`,
                pending: sql `cast(count(*) filter (
          where ${sql.raw(EMBEDDING_ELIGIBLE_SQL_PREDICATE)} and not exists (
            select 1 from media_embeddings
            where media_id = series.id and media_type = 'SERIES'
          )
        ) as integer)`,
            }).from(series),
        ]);
        const mTotal = Number(movieStats[0]?.total ?? 0);
        const mWithAvail = Number(movieStats[0]?.withAvailability ?? 0);
        const mNeverEnriched = Number(movieStats[0]?.neverEnriched ?? 0);
        const mPartially = Number(movieStats[0]?.partiallyEnriched ?? 0);
        const mFully = Number(movieStats[0]?.fullyEnriched ?? 0);
        const mEnriched = mPartially + mFully;
        const mEligible = Number(movieEmbeddingCount[0]?.eligible ?? 0);
        const mPending = Number(movieEmbeddingCount[0]?.pending ?? 0);
        const sTotal = Number(seriesStats[0]?.total ?? 0);
        const sWithAvail = Number(seriesStats[0]?.withAvailability ?? 0);
        const sNeverEnriched = Number(seriesStats[0]?.neverEnriched ?? 0);
        const sPartially = Number(seriesStats[0]?.partiallyEnriched ?? 0);
        const sFully = Number(seriesStats[0]?.fullyEnriched ?? 0);
        const sEnriched = sPartially + sFully;
        const sEligible = Number(seriesEmbeddingCount[0]?.eligible ?? 0);
        const sPending = Number(seriesEmbeddingCount[0]?.pending ?? 0);
        return {
            movies: {
                total: mTotal,
                withAvailability: mWithAvail,
                withoutAvailability: mTotal - mWithAvail,
                upcoming: Number(movieStats[0]?.upcoming ?? 0),
                enriched: mEnriched,
                neverEnriched: mNeverEnriched,
                partiallyEnriched: mPartially,
                fullyEnriched: mFully,
                stale: Number(movieStats[0]?.stale ?? 0),
                failedLastEnrichment: Number(movieFailureCount[0]?.cnt ?? 0),
                embeddingEligible: mEligible,
                // embeddingBlocked is currently always 0 because eligibility == enriched (metadataEnrichedAt IS NOT NULL).
                // It will become meaningful when the embedding policy adds stricter field requirements.
                embeddingBlocked: mEnriched - mEligible,
                embeddingPending: mPending,
            },
            series: {
                total: sTotal,
                withAvailability: sWithAvail,
                withoutAvailability: sTotal - sWithAvail,
                upcoming: Number(seriesStats[0]?.upcoming ?? 0),
                enriched: sEnriched,
                neverEnriched: sNeverEnriched,
                partiallyEnriched: sPartially,
                fullyEnriched: sFully,
                stale: Number(seriesStats[0]?.stale ?? 0),
                failedLastEnrichment: Number(seriesFailureCount[0]?.cnt ?? 0),
                embeddingEligible: sEligible,
                // embeddingBlocked is currently always 0 because eligibility == enriched (metadataEnrichedAt IS NOT NULL).
                // It will become meaningful when the embedding policy adds stricter field requirements.
                embeddingBlocked: sEnriched - sEligible,
                embeddingPending: sPending,
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
        };
    });
}
//# sourceMappingURL=catalog-stats.js.map