import type { MetadataCandidate } from '../providers/metadata/types.js';
export interface ScoreInput {
    normalizedTitle: string;
    extractedYear: number | null;
    providerYear?: number | null;
    mediaType: 'MOVIE' | 'SERIES';
}
export interface ScoredCandidate {
    candidate: MetadataCandidate;
    confidence: number;
    rawScore: number;
    titleScore: number;
    yearScore: number;
}
export declare const MATCH_THRESHOLD = 0.85;
export declare const AMBIGUITY_GAP = 0.15;
export declare const CANDIDATE_THRESHOLD = 0.5;
export declare function scoreCandidates(input: ScoreInput, candidates: MetadataCandidate[]): ScoredCandidate[];
//# sourceMappingURL=candidate-scorer.d.ts.map