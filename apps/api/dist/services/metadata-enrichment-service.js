import { and, eq, inArray, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { movies, movieGenres } from '../db/schema/movies.js';
import { series, seriesGenres } from '../db/schema/series.js';
import { genres } from '../db/schema/genres.js';
import { mediaVideos } from '../db/schema/media-videos.js';
import { mediaCredits } from '../db/schema/media-credits.js';
const DEFAULT_STALE_DAYS = 7;
const ENRICH_THROTTLE_MS = 250;
function slugify(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}
async function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function pickBestTrailer(videos) {
    const officialTrailer = videos.find((v) => v.official && v.type === 'Trailer');
    if (officialTrailer)
        return officialTrailer;
    const anyTrailer = videos.find((v) => v.type === 'Trailer');
    if (anyTrailer)
        return anyTrailer;
    const teaser = videos.find((v) => v.official && v.type === 'Teaser') ?? videos.find((v) => v.type === 'Teaser');
    return teaser ?? null;
}
export class MetadataEnrichmentService {
    db;
    provider;
    staleDays;
    constructor(db, provider, staleDays = DEFAULT_STALE_DAYS) {
        this.db = db;
        this.provider = provider;
        this.staleDays = staleDays;
    }
    async enrichMovie(movieId, opts) {
        const staleDays = opts?.staleDays ?? this.staleDays;
        const [movie] = await this.db
            .select({
            id: movies.id,
            tmdbId: movies.tmdbId,
            metadataEnrichedAt: movies.metadataEnrichedAt,
        })
            .from(movies)
            .where(eq(movies.id, movieId));
        if (!movie)
            return 'no-tmdb-id';
        if (movie.tmdbId === null)
            return 'no-tmdb-id';
        if (!opts?.force && movie.metadataEnrichedAt !== null) {
            const threshold = new Date(Date.now() - staleDays * 86_400_000);
            if (movie.metadataEnrichedAt > threshold)
                return 'skipped';
        }
        let metadata, videos, credits, certification;
        try {
            ;
            [metadata, videos, credits, certification] = await Promise.all([
                this.provider.getMovieMetadata(movie.tmdbId),
                this.provider.getMovieVideos(movie.tmdbId),
                this.provider.getMovieCredits(movie.tmdbId),
                this.provider.getMovieCertification(movie.tmdbId),
            ]);
        }
        catch {
            return 'provider-failed';
        }
        if (metadata === null)
            return 'provider-failed';
        await this.db
            .update(movies)
            .set({
            title: metadata.title,
            originalTitle: metadata.originalTitle,
            year: metadata.year,
            synopsis: metadata.synopsis,
            posterPath: metadata.posterPath,
            backdropPath: metadata.backdropPath,
            durationMinutes: metadata.runtimeMinutes,
            imdbId: metadata.imdbId,
            voteAverage: metadata.voteAverage,
            certification,
            metadataProvider: 'tmdb',
            metadataEnrichedAt: new Date(),
            updatedAt: new Date(),
        })
            .where(eq(movies.id, movieId));
        await this.upsertGenres(metadata.genres, async (genreIds) => {
            await this.db.delete(movieGenres).where(eq(movieGenres.movieId, movieId));
            if (genreIds.length > 0) {
                await this.db
                    .insert(movieGenres)
                    .values(genreIds.map((genreId) => ({ movieId, genreId })));
            }
        });
        await this.persistVideos('movie', movieId, videos);
        await this.persistCredits('movie', movieId, credits);
        return 'enriched';
    }
    async enrichSeries(seriesId, opts) {
        const staleDays = opts?.staleDays ?? this.staleDays;
        const [seriesRow] = await this.db
            .select({
            id: series.id,
            tmdbId: series.tmdbId,
            metadataEnrichedAt: series.metadataEnrichedAt,
        })
            .from(series)
            .where(eq(series.id, seriesId));
        if (!seriesRow)
            return 'no-tmdb-id';
        if (seriesRow.tmdbId === null)
            return 'no-tmdb-id';
        if (!opts?.force && seriesRow.metadataEnrichedAt !== null) {
            const threshold = new Date(Date.now() - staleDays * 86_400_000);
            if (seriesRow.metadataEnrichedAt > threshold)
                return 'skipped';
        }
        let metadata, videos, credits, certification;
        try {
            ;
            [metadata, videos, credits, certification] = await Promise.all([
                this.provider.getSeriesMetadata(seriesRow.tmdbId),
                this.provider.getSeriesVideos(seriesRow.tmdbId),
                this.provider.getSeriesCredits(seriesRow.tmdbId),
                this.provider.getSeriesCertification(seriesRow.tmdbId),
            ]);
        }
        catch {
            return 'provider-failed';
        }
        if (metadata === null)
            return 'provider-failed';
        await this.db
            .update(series)
            .set({
            title: metadata.title,
            originalTitle: metadata.originalTitle,
            firstAirYear: metadata.firstAirYear,
            synopsis: metadata.synopsis,
            posterPath: metadata.posterPath,
            backdropPath: metadata.backdropPath,
            imdbId: metadata.imdbId,
            voteAverage: metadata.voteAverage,
            certification,
            status: metadata.status,
            metadataProvider: 'tmdb',
            metadataEnrichedAt: new Date(),
            updatedAt: new Date(),
        })
            .where(eq(series.id, seriesId));
        await this.upsertGenres(metadata.genres, async (genreIds) => {
            await this.db.delete(seriesGenres).where(eq(seriesGenres.seriesId, seriesId));
            if (genreIds.length > 0) {
                await this.db
                    .insert(seriesGenres)
                    .values(genreIds.map((genreId) => ({ seriesId, genreId })));
            }
        });
        await this.persistVideos('series', seriesId, videos);
        await this.persistCredits('series', seriesId, credits);
        return 'enriched';
    }
    async enrichPending(opts) {
        const staleDays = opts?.staleDays ?? this.staleDays;
        const threshold = new Date(Date.now() - staleDays * 86_400_000);
        const [moviesToEnrich, seriesToEnrich] = await Promise.all([
            this.db
                .select({ id: movies.id })
                .from(movies)
                .where(and(isNotNull(movies.tmdbId), or(isNull(movies.metadataEnrichedAt), lt(movies.metadataEnrichedAt, threshold)))),
            this.db
                .select({ id: series.id })
                .from(series)
                .where(and(isNotNull(series.tmdbId), or(isNull(series.metadataEnrichedAt), lt(series.metadataEnrichedAt, threshold)))),
        ]);
        const counts = {
            movies: { enriched: 0, skipped: 0, failed: 0 },
            series: { enriched: 0, skipped: 0, failed: 0 },
        };
        let firstCall = true;
        for (const movie of moviesToEnrich) {
            if (!firstCall)
                await delay(ENRICH_THROTTLE_MS);
            firstCall = false;
            try {
                const status = await this.enrichMovie(movie.id, { staleDays, force: opts?.force });
                if (status === 'enriched')
                    counts.movies.enriched++;
                else if (status === 'skipped' || status === 'no-tmdb-id')
                    counts.movies.skipped++;
                else
                    counts.movies.failed++;
            }
            catch {
                counts.movies.failed++;
            }
        }
        for (const s of seriesToEnrich) {
            if (!firstCall)
                await delay(ENRICH_THROTTLE_MS);
            firstCall = false;
            try {
                const status = await this.enrichSeries(s.id, { staleDays, force: opts?.force });
                if (status === 'enriched')
                    counts.series.enriched++;
                else if (status === 'skipped' || status === 'no-tmdb-id')
                    counts.series.skipped++;
                else
                    counts.series.failed++;
            }
            catch {
                counts.series.failed++;
            }
        }
        return counts;
    }
    async persistVideos(mediaType, mediaId, videos) {
        await this.db
            .delete(mediaVideos)
            .where(and(eq(mediaVideos.mediaType, mediaType), eq(mediaVideos.mediaId, mediaId)));
        const best = pickBestTrailer(videos);
        if (!best)
            return;
        await this.db.insert(mediaVideos).values({
            mediaType,
            mediaId,
            youtubeKey: best.key,
            videoType: best.type,
            official: best.official,
            publishedAt: best.publishedAt ? new Date(best.publishedAt) : null,
        });
    }
    async persistCredits(mediaType, mediaId, credits) {
        await this.db
            .delete(mediaCredits)
            .where(and(eq(mediaCredits.mediaType, mediaType), eq(mediaCredits.mediaId, mediaId)));
        if (credits.length === 0)
            return;
        await this.db.insert(mediaCredits).values(credits.map((c) => ({
            mediaType,
            mediaId,
            role: c.role,
            name: c.name,
            character: c.character,
            creditOrder: c.order,
            profilePath: c.profilePath,
        })));
    }
    async upsertGenres(genreNames, linkFn) {
        if (genreNames.length === 0) {
            await linkFn([]);
            return;
        }
        const genreValues = genreNames.map((name) => ({ name, slug: slugify(name) }));
        const slugs = genreValues.map((g) => g.slug);
        await this.db.insert(genres).values(genreValues).onConflictDoNothing();
        const genreRows = await this.db
            .select({ id: genres.id, slug: genres.slug })
            .from(genres)
            .where(inArray(genres.slug, slugs));
        await linkFn(genreRows.map((r) => r.id));
    }
}
//# sourceMappingURL=metadata-enrichment-service.js.map