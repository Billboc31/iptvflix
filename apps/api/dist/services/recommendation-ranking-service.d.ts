import type { RecommendationsResponse, ScoreBreakdown, RecommendationQueryPlan } from '@iptvflix/api-contracts';
export type AvailabilityPolicy = 'ALL' | 'WATCH_NOW' | 'DISCOVERY' | 'UPCOMING';
type RankOpts = {
    mediaType?: 'MOVIE' | 'SERIES';
    availableToMe?: boolean;
    availabilityPolicy?: AvailabilityPolicy;
    includeSeen?: boolean;
    limit?: number;
    positiveMediaIds?: string[];
    preferGenreIds?: string[];
};
export declare function rankRecommendations(profileId: string, opts?: RankOpts): Promise<RecommendationsResponse>;
export declare const SCORE_MODEL_V1: {
    readonly version: "v1";
    readonly wSemantic: 0.35;
    readonly wGenre: 0.25;
    readonly wTheme: 0.15;
    readonly wPeople: 0.1;
    readonly wFreshness: 0.05;
    readonly wPrior: 0.1;
    readonly wAvailability: 0.05;
};
export type ExplorationLevel = 'exploit' | 'explore' | 'discover';
export interface HybridCandidate {
    mediaId: string;
    mediaType: 'MOVIE' | 'SERIES';
    title: string;
    year: number | null;
    posterPath: string | null;
    source: 'LOCAL' | 'DISCOVERY';
    similarity: number;
    genreIds: string[];
    genreNames: string[];
    popularity: number | null;
    voteAverage: number | null;
    available: boolean;
    status: string | null;
    collectionId: string | null;
    directors: string[];
    keywords: string[];
    durationMinutes: number | null;
    originalLanguage: string | null;
    completionRatio: number | null;
}
export interface TasteSignals {
    genreScores: Record<string, number>;
    genreNames: Record<string, string>;
    positiveMediaIds: ReadonlySet<string>;
    negativeMediaIds: ReadonlySet<string>;
    signalCount: number;
}
export interface RankingOptions {
    limit?: number;
    availabilityPolicy?: AvailabilityPolicy;
    explorationLevel?: ExplorationLevel;
    diversityEnabled?: boolean;
    maxPerCollection?: number;
    maxPerDirector?: number;
    alreadyShownIds?: string[];
    debug?: boolean;
    includeSeen?: boolean;
}
export type ScoredHybridCandidate = HybridCandidate & {
    score: number;
    reasons: string[];
    scoreBreakdown?: ScoreBreakdown;
};
/** @deprecated — use recommendation-engine (apps/recommendation-engine/src/pipeline/stages/hybrid-reranker.ts) */
export declare function rankHybrid(candidates: HybridCandidate[], queryPlan: RecommendationQueryPlan, taste: TasteSignals | null, opts?: RankingOptions): ScoredHybridCandidate[];
export declare function resolveImplicitShownIds(profileId: string, hoursBack: number): Promise<string[]>;
export {};
//# sourceMappingURL=recommendation-ranking-service.d.ts.map