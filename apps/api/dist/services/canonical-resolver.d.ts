import type { MetadataEnrichmentService } from './metadata-enrichment-service.js';
export interface ResolveMovieInput {
    tmdbId: number | null;
    /** ID from title-matching pre-pass. undefined = not attempted; null = AMBIGUOUS or UNMATCHED */
    prePassId?: string | null;
    tmdbCache?: Map<number, string>;
}
export interface ResolveSeriesInput {
    tmdbId: number | null;
    /** ID from title-matching pre-pass. undefined = not attempted; null = AMBIGUOUS or UNMATCHED */
    prePassId?: string | null;
    tmdbCache?: Map<number, string>;
}
export interface ResolveEpisodeInput {
    seriesId: string;
    seasonNumber: number;
    episodeNumber: number;
    episodeMeta?: {
        title?: string | null;
        synopsis?: string | null;
        durationMinutes?: number | null;
        airDate?: string | null;
        posterPath?: string | null;
    };
}
/**
 * Resolves provider items to canonical catalog entities without writing any provider
 * metadata to canonical fields. Canonical title/synopsis/poster are only populated
 * by MetadataEnrichmentService.
 *
 * Resolution order:
 *   1. TMDB ID present → local DB lookup → importByTmdbId if absent
 *   2. No TMDB ID → use pre-pass result (MATCHED canonical ID or null for AMBIGUOUS/UNMATCHED)
 *   3. Returns null when resolution fails — callers must skip availability creation.
 */
export declare class CanonicalResolver {
    private readonly enrichmentService;
    private readonly onNewEpisode?;
    constructor(enrichmentService: MetadataEnrichmentService, onNewEpisode?: ((episodeId: string) => void) | undefined);
    resolveMovieCanonical(input: ResolveMovieInput): Promise<{
        id: string;
    } | null>;
    resolveSeriesCanonical(input: ResolveSeriesInput): Promise<{
        id: string;
    } | null>;
    /**
     * Ensures season and episode canonical records exist for the given coordinates.
     * Episode metadata (title, airDate, etc.) is accepted from the caller for the initial
     * record; MetadataEnrichmentService.enrichSeriesSeasons overwrites these with TMDB data.
     */
    resolveEpisodeCanonical(input: ResolveEpisodeInput): Promise<{
        id: string;
    } | null>;
}
//# sourceMappingURL=canonical-resolver.d.ts.map