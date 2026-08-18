import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'

/** Keep in sync with packages/api-contracts/src/query-plan.ts — runtime copy so node dist/index.js never loads the TS package. */
export const QUERY_PLAN_SCHEMA_VERSION = '1' as const

export function rawQueryFallbackPlan(rawQuery: string): RecommendationQueryPlan {
  return {
    schemaVersion: QUERY_PLAN_SCHEMA_VERSION,
    rawQuery,
    displayTitle: rawQuery,
    semanticIntent: rawQuery,
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: ['MOVIE', 'SERIES'],
    hardFilters: {},
    softPreferences: {},
    userConstraints: [],
    plannerFallback: true,
    plannerMeta: null,
  }
}
