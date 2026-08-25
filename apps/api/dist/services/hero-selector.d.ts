import type { HeroItem } from '@iptvflix/api-contracts';
import type { ShelfCandidateItem } from '../client/recommendation-engine-client.js';
type HeroWeights = {
    version: string;
    profileRelevance: number;
    semanticConfidence: number;
    qualityPrior: number;
    languageAffinity: number;
};
export declare function computeHeroScore(candidate: ShelfCandidateItem, weights: HeroWeights): number;
export declare function selectHero(profileId: string, candidates: ShelfCandidateItem[]): Promise<HeroItem | null>;
export {};
//# sourceMappingURL=hero-selector.d.ts.map