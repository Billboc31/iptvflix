import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts';
import type { LlmPlannerProvider } from './llm-planner-provider.js';
export declare class LlmQueryPlannerService {
    private readonly provider;
    constructor(provider: LlmPlannerProvider | null);
    plan(rawQuery: string, profileContext: CompactTasteContext | null): Promise<RecommendationQueryPlan>;
}
//# sourceMappingURL=llm-query-planner-service.d.ts.map