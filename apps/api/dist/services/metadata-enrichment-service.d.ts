import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { MetadataProvider } from '../providers/metadata/types.js';
type Db = PostgresJsDatabase<typeof schema>;
export type EnrichResult = 'enriched' | 'skipped' | 'no-tmdb-id' | 'provider-failed' | 'terminal-failed';
export interface EnrichmentCounters {
    enriched: number;
    skipped: number;
    failed: number;
}
export interface EnrichPendingResult {
    movies: EnrichmentCounters;
    series: EnrichmentCounters;
}
export declare class MetadataEnrichmentService {
    private readonly db;
    private readonly provider;
    private readonly staleDays;
    private readonly onEnriched?;
    constructor(db: Db, provider: MetadataProvider, staleDays?: number, onEnriched?: ((mediaId: string, mediaType: "MOVIE" | "SERIES") => void) | undefined);
    persistFailure(opts: {
        mediaType: 'MOVIE' | 'SERIES';
        mediaId: string;
        tmdbId?: number | null;
        title?: string | null;
        stage: 'fetch' | 'map' | 'db_update' | 'seasons';
        err: unknown;
        runId?: string | null;
    }): Promise<{
        retryable: boolean;
    }>;
    private clearFailure;
    enrichMovie(movieId: string, opts?: {
        force?: boolean;
        staleDays?: number;
        runId?: string;
    }): Promise<EnrichResult>;
    enrichSeries(seriesId: string, opts?: {
        force?: boolean;
        staleDays?: number;
        runId?: string;
    }): Promise<EnrichResult>;
    enrichSeriesSeasons(seriesId: string): Promise<{
        result: 'no-tmdb-id' | 'enriched';
        episodes: EnrichmentCounters;
    }>;
    /**
     * Ensures a canonical movie row exists for the given TMDB ID.
     * When the movie is not in the local DB, fetches the title from TMDB and inserts
     * a canonical skeleton (no provider metadata). Enrichment fills the rest later.
     */
    importMovieByTmdbId(tmdbId: number): Promise<{
        id: string;
    } | null>;
    /**
     * Ensures a canonical series row exists for the given TMDB ID.
     * When the series is not in the local DB, fetches the title from TMDB and inserts
     * a canonical skeleton (no provider metadata). Enrichment fills the rest later.
     */
    importSeriesByTmdbId(tmdbId: number): Promise<{
        id: string;
    } | null>;
    enrichPending(opts?: {
        staleDays?: number;
        force?: boolean;
    }): Promise<EnrichPendingResult>;
    private persistVideos;
    private persistCredits;
    private persistFrenchLocalization;
    private upsertGenres;
}
export {};
//# sourceMappingURL=metadata-enrichment-service.d.ts.map