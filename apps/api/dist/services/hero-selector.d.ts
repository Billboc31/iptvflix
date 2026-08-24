import { HERO_SCORE_WEIGHTS } from '../config/env.js';
import type { HeroItem } from '@iptvflix/api-contracts';
import type { ShelfCandidateItem } from '../client/recommendation-engine-client.js';
export declare function computeHeroScore(candidate: ShelfCandidateItem, weights: typeof HERO_SCORE_WEIGHTS): number;
export declare function selectHero(profileId: string, candidates: ShelfCandidateItem[]): Promise<HeroItem | null>;
//# sourceMappingURL=hero-selector.d.ts.map