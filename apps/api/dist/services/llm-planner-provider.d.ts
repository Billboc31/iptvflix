import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts';
export interface LlmPlannerProvider {
    readonly provider: string;
    readonly model: string;
    readonly promptVersion: string;
    planQuery(rawQuery: string, profileContext: CompactTasteContext | null): Promise<RecommendationQueryPlan>;
}
//# sourceMappingURL=llm-planner-provider.d.ts.map