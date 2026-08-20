import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { TmdbClient } from '../providers/metadata/tmdb/client.js';
type Db = PostgresJsDatabase<typeof schema>;
export interface SimilarTitleCard {
    id: string;
    tmdbId: number;
    title: string;
    posterPath: string | null;
    year: number | null;
    voteAverage: number;
    isAvailable: boolean;
}
export declare class SimilarTitlesService {
    private readonly db;
    private readonly tmdbClient;
    private readonly movieCache;
    private readonly seriesCache;
    constructor(db: Db, tmdbClient: TmdbClient);
    getSimilarMovies(movieId: string, limit?: number): Promise<SimilarTitleCard[]>;
    getSimilarSeries(seriesId: string, limit?: number): Promise<SimilarTitleCard[]>;
    private resolveMovieCandidates;
    private resolveSeriesCandidates;
    private fallbackMoviesByGenre;
    private fallbackSeriesByGenre;
    private buildMovieAvailabilitySet;
    private buildSeriesAvailabilitySet;
    private materializeMovie;
    private upsertMovieGenres;
    private materializeSeries;
    private upsertSeriesGenres;
}
export {};
//# sourceMappingURL=similar-titles-service.d.ts.map