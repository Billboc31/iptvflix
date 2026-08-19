import { rawQueryFallbackPlan } from '../query-plan-fallback.js';
const TIMEOUT_MS = 8000;
function withTimeout(promise, ms) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error(`LLM planner timed out after ${ms}ms`)), ms));
    return Promise.race([promise, timeout]);
}
export class LlmQueryPlannerService {
    provider;
    constructor(provider) {
        this.provider = provider;
    }
    async plan(rawQuery, profileContext) {
        if (!this.provider) {
            return rawQueryFallbackPlan(rawQuery);
        }
        try {
            const result = await withTimeout(this.provider.planQuery(rawQuery, profileContext), TIMEOUT_MS);
            if (!result.semanticIntent || result.semanticIntent.trim() === '') {
                console.warn('[LlmQueryPlannerService] semanticIntent is empty — falling back to raw query');
                return rawQueryFallbackPlan(rawQuery);
            }
            return result;
        }
        catch (err) {
            console.warn('[LlmQueryPlannerService] planner failed, using fallback:', err.message);
            return rawQueryFallbackPlan(rawQuery);
        }
    }
}
//# sourceMappingURL=llm-query-planner-service.js.map