import type { RecommendationQueryPlan } from '@iptvflix/api-contracts';
/** Keep in sync with packages/api-contracts/src/query-plan.ts — runtime copy so node dist/index.js never loads the TS package. */
export declare const QUERY_PLAN_SCHEMA_VERSION: "1";
export declare function rawQueryFallbackPlan(rawQuery: string): RecommendationQueryPlan;
//# sourceMappingURL=query-plan-fallback.d.ts.map