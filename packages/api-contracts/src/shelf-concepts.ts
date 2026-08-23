import type { ScoreBreakdown } from './recommendations.js'
import type { RecommendationQueryPlan } from './query-plan.js'

export type ShelfConceptGenerationType = 'PERSONALIZED' | 'EXPLORATION' | 'DISCOVERY' | 'FIXED' | 'EDITORIAL'
export type ShelfConceptFreshnessPolicy = 'AVAILABLE_NOW' | 'NEW_RELEASES' | 'ALL'

export type ShelfConcept = {
  id: string
  profileId: string | null
  title: string
  rawIntent: string
  semanticIntent: string
  generationType: ShelfConceptGenerationType
  reasonCodes: string[]
  sourceModel: string
  promptVersion: string
  desiredMediaTypes: ('MOVIE' | 'SERIES')[]
  freshnessPolicy: ShelfConceptFreshnessPolicy | null
  active: boolean
  createdAt: string
  expiresAt: string | null
  reachCount: number
  openCount: number
  playCount: number
  completionCount: number
  dismissCount: number
}

export type ShelfConceptProfileContext = {
  topGenres: string[]
  topThemes: string[]
  likedPeople: string[]
  recentlyWatched: string[]
  negativeSignals: string[]
  mediaTypeBalance: { movies: number; series: number; anime: number }
  runtimePreference: 'short' | 'standard' | 'long' | 'mixed'
  languagePreferences: string[]
  recentCompletions: string[]
  recentAbandons: string[]
  bingeTendency: boolean
  recentShelfConcepts: Array<{ title: string; generationType: string; openRate: number }>
  newCatalogSignals: string[]
  isKids: boolean
  coldStart: boolean
}

export type GenerateShelfConceptsBody = {
  profileId: string
  count?: number
}

export type GenerateShelfConceptsResponse = {
  concepts: ShelfConcept[]
  coldStart: boolean
  profileContext: ShelfConceptProfileContext
}

export type ShelfConceptFeedbackBody = {
  signal: 'good' | 'bad'
}

export type ShelfConceptPreviewResponse = {
  rawVector: Array<{ id: string; title: string; vectorScore: number }>
  finalPersonalized: Array<{ id: string; title: string; finalScore: number; scoreBreakdown?: ScoreBreakdown }>
  candidatePoolSize: number
  queryPlan: RecommendationQueryPlan
  semanticAvailable: boolean
  semanticFallbackReason?: string
  semanticDiagnostics?: Record<string, unknown>
  fallbackFlags: string[]
  stageAvailability: Array<{ name: string; available: boolean; reason?: string }>
  retrievalCounts: {
    retrieved: number
    postFilter: number | null
    reranked: number | null
    final: number
  }
}
