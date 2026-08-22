import type { RecommendationQueryPlan, QueryPlanHardFilters } from '@iptvflix/api-contracts'

export function buildQueryPlanFromShelfConcept(concept: {
  semanticIntent: string
  title: string
  desiredMediaTypes: string[] | null
  freshnessPolicy: string | null
}): RecommendationQueryPlan {
  const rawDesiredTypes = (concept.desiredMediaTypes ?? []) as string[]
  const resolvedMediaTypes = rawDesiredTypes
    .map((t) => t.toLowerCase())
    .filter((t): t is 'movie' | 'series' => t === 'movie' || t === 'series')
  const planMediaTypes: ('MOVIE' | 'SERIES')[] =
    resolvedMediaTypes.length > 0
      ? resolvedMediaTypes.map((t) => t.toUpperCase() as 'MOVIE' | 'SERIES')
      : ['MOVIE', 'SERIES']

  const hardFilters: QueryPlanHardFilters = {}
  if (concept.freshnessPolicy === 'NEW_RELEASES') {
    hardFilters.minReleaseYear = new Date().getFullYear() - 2
  }

  return {
    schemaVersion: '1',
    rawQuery: concept.semanticIntent,
    displayTitle: concept.title,
    semanticIntent: concept.semanticIntent,
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: planMediaTypes,
    hardFilters,
    softPreferences: {},
    userConstraints: [],
    plannerFallback: true,
    plannerMeta: null,
  }
}
