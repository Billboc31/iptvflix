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
export declare class TitleMatchingService {
    private readonly metadataProvider;
    constructor(metadataProvider: MetadataProvider);
    matchItem(input: MatchItemInput): Promise<MatchResult>;
    matchBatch(inputs: MatchItemInput[]): Promise<MatchResult[]>;
}
//# sourceMappingURL=title-matching-service.d.ts.map