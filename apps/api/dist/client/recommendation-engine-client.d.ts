import type { EngineMetadata, RecommendationQueryPlan, ShelfConceptPreviewResponse } from '@iptvflix/api-contracts';
export type EnginePreviewResult<T> = {
    ok: true;
    data: T;
} | {
    ok: false;
    kind: 'not-found' | 'server-error' | 'timeout' | 'unreachable' | 'circuit-open';
    status?: number;
    message?: string;
};
export interface EngineQueryResult {
    requestId: string;
    results: Array<{
        id: string;
        mediaType: 'movie' | 'series';
        title: string;
        year?: number | null;
        posterPath?: string | null;
        score?: number;
        reasons?: string[];
        scoreBreakdown?: Record<string, number>;
        available?: boolean;
    }>;
    engineMetadata: EngineMetadata;
    queryPlan?: RecommendationQueryPlan;
}
export interface ShelfCandidateItem {
    mediaId: string;
    mediaType: 'MOVIE' | 'SERIES';
    semanticScore: number;
    profileScore: number;
    finalScore: number;
    reasons: string[];
    available: boolean;
    qualityPrior: number;
    languageAffinity: number;
}
export interface ShelfQueryResult {
    candidates: ShelfCandidateItem[];
    queryPlannerVersion: string;
    embeddingModelVersion: string;
    rankerVersion: string;
    candidateCount: number;
}
export interface EnginePersonalizedResult {
    requestId: string;
    results: Array<{
        id: string;
        mediaType: 'movie' | 'series';
        title: string;
        year?: number | null;
        posterPath?: string | null;
        score?: number;
        reasons?: string[];
    }>;
    engineMetadata: EngineMetadata;
}
export interface EngineShelfConceptsResult {
    concepts: unknown[];
    coldStart: boolean;
    profileContext: unknown;
}
export interface EngineShelfInstanceResult {
    shelf: {
        id: string;
        title: string;
        type: string;
        layoutHint: string;
        position: number;
    };
    explanation: {
        inferredGenreIds: string[];
        seedTitles: string[];
        generatedAt: string;
    };
}
export declare const RecommendationEngineClient: {
    isConfigured(): boolean;
    query(params: {
        text: string;
        profileId?: string;
        mediaTypes?: ("movie" | "series")[];
        limit?: number;
        debug?: boolean;
        freshnessBoostDays?: number;
    }): Promise<EngineQueryResult | null>;
    personalized(params: {
        profileId: string;
        mediaTypes?: ("movie" | "series")[];
        limit?: number;
    }): Promise<EnginePersonalizedResult | null>;
    generateShelfConcepts(params: {
        profileId: string;
        count?: number;
    }): Promise<EngineShelfConceptsResult | null>;
    getShelfConcepts(profileId: string): Promise<unknown[] | null>;
    shelfConceptFeedback(conceptId: string, signal: "good" | "bad"): Promise<boolean>;
    generateShelfInstance(params: {
        profileId: string;
        [key: string]: unknown;
    }): Promise<EngineShelfInstanceResult | null>;
    queryForShelf(params: {
        text: string;
        profileId: string;
        limit: number;
        mediaTypeFilter?: "MOVIE" | "SERIES";
        freshnessBoostDays?: number;
    }): Promise<ShelfQueryResult | null>;
    previewShelfConcept(conceptId: string, body: {
        profileId: string;
        debug?: boolean;
    }): Promise<EnginePreviewResult<ShelfConceptPreviewResponse>>;
    refreshShelfInstance(shelfId: string, profileId: string): Promise<EngineShelfInstanceResult | null>;
};
//# sourceMappingURL=recommendation-engine-client.d.ts.map