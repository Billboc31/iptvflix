import type { RecommendationsResponse } from '@iptvflix/api-contracts';
type RankOpts = {
    mediaType?: 'MOVIE' | 'SERIES';
    availableToMe?: boolean;
    includeSeen?: boolean;
    limit?: number;
    positiveMediaIds?: string[];
    preferGenreIds?: string[];
};
export declare function rankRecommendations(profileId: string, opts?: RankOpts): Promise<RecommendationsResponse>;
export {};
//# sourceMappingURL=recommendation-ranking-service.d.ts.map