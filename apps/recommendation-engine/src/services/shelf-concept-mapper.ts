import type { RecommendationQueryPlan, QueryPlanHardFilters } from '@iptvflix/api-contracts'

function resolveSemanticProtection(
  generationType: string | undefined | null,
): 'strict' | 'moderate' | 'none' {
  switch (generationType) {
    case 'FIXED':
    case 'EDITORIAL':
      return 'strict'
    case 'DISCOVERY':
      return 'none'
    case 'PERSONALIZED':
    case 'EXPLORATION':
    default:
      return 'moderate'
  }
}

export function buildQueryPlanFromShelfConcept(concept: {
  semanticIntent: string
  title: string
  desiredMediaTypes: string[] | null
  freshnessPolicy: string | null
  generationType?: string | null
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
    semanticProtection: resolveSemanticProtection(concept.generationType),
    plannerMeta: null,
  }
}
