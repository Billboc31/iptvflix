export const QUERY_PLAN_SCHEMA_VERSION = '1' as const

export type CompactTasteContext = {
  topGenres: string[]
  topThemes: string[]
  likedPeople: string[]
  recentlyWatched: string[]
  negativeSignals: string[]
}

export type QueryPlanHardFilters = {
  maxRuntimeMinutes?: number
  minReleaseYear?: number
  maxReleaseYear?: number
  audioLanguages?: string[]
  includeGenres?: string[]
  excludeGenres?: string[]
  // TODO: maturity/kids restriction — field defined but not yet enforced in passesHardFilters
  maxMaturityRating?: string
  kidsOnly?: boolean
}

export type QueryPlanSoftPreferences = {
  preferredDecades?: string[]
  preferredDirectors?: string[]
  preferredLanguages?: string[]
}

export type RecommendationQueryPlan = {
  schemaVersion: typeof QUERY_PLAN_SCHEMA_VERSION
  rawQuery: string
  displayTitle: string
  semanticIntent: string
  desiredThemes: string[]
  desiredTone: string[]
  avoidSignals: string[]
  mediaTypes: ('MOVIE' | 'SERIES')[]
  hardFilters: QueryPlanHardFilters
  softPreferences: QueryPlanSoftPreferences
  userConstraints: string[]
  plannerFallback: boolean
  plannerMeta: {
    provider: string
    model: string
    promptVersion: string
    latencyMs: number
  } | null
}

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
