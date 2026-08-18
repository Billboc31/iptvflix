import type { MetadataProvider } from '../providers/metadata/types.js';
export interface MatchItemInput {
    providerId: string;
    providerItemId: string;
    rawTitle: string;
    mediaType: 'MOVIE' | 'SERIES';
    providerYear?: number | null;
    providerTmdbId?: number | null;
}
export interface MatchResult {
    id: string;
    providerId: string;
    providerItemId: string;
    matchState: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS';
    confidence: number | null;
    movieId: string | null;
    seriesId: string | null;
    normalizedTitle: string;
    extractedYear: number | null;
    candidateCount: number;
    notes: string;
}
/** Punctuation-insensitive key so "Dune: Part Two" matches "Dune Part Two". */
export declare function catalogMatchKey(raw: string): string;
export declare class TitleMatchingService {
    private readonly metadataProvider;
    constructor(metadataProvider: MetadataProvider);
    private movieIndex;
    private seriesIndex;
    private localIndex;
    matchItem(input: MatchItemInput): Promise<MatchResult>;
    /**
     * Match a batch of items using a bounded-concurrency sliding window.
     * When opts is omitted, runs sequentially (preserves test isolation).
     * Per-item errors (e.g. TMDB network failures) produce a synthetic UNMATCHED
     * result instead of aborting the whole batch.
     */
    matchBatch(inputs: MatchItemInput[], opts?: {
        concurrency?: number;
        throttleMs?: number;
    }): Promise<MatchResult[]>;
}
//# sourceMappingURL=title-matching-service.d.ts.map