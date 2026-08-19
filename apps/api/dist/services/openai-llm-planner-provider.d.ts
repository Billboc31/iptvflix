import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts';
import type { LlmPlannerProvider } from './llm-planner-provider.js';
export declare class OpenAiLlmPlannerProvider implements LlmPlannerProvider {
    readonly provider = "openai";
    readonly promptVersion = "query-planner-v1";
    readonly model: string;
    private readonly client;
    constructor(apiKey: string, model: string);
    planQuery(rawQuery: string, profileContext: CompactTasteContext | null): Promise<RecommendationQueryPlan>;
}
export declare function createOpenAiPlannerProvider(apiKey: string, model: string): OpenAiLlmPlannerProvider;
//# sourceMappingURL=openai-llm-planner-provider.d.ts.map