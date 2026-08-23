import type { EngineMetadata } from './engine-metadata.js'

export type RecommendationSource = 'LOCAL' | 'DISCOVERY' | 'ENGINE'

export interface ScoreBreakdown {
  modelVersion: string
  semantic: number
  semanticContribution?: number
  profileContribution?: number
  profileGenreContribution?: number
  profileThemeContribution?: number
  peopleContribution?: number
  languageContribution?: number
  eraContribution?: number
  otherPositiveContributions?: number
  genreAffinity: number
  themeAffinity: number
  peopleAffinity: number
  keywordAffinity: number
  franchiseAffinity: number
  languageAffinity: number
  decadeAffinity: number
  mediaTypeAffinity: number
  qualityPrior: number
  freshness: number
  availabilityBonus: number
  alreadyWatchedPenalty: number
  abandonPenalty: number
  dislikedPenalty: number
  avoidPenalty: number
  repetitionPenalty: number
  semanticRelevanceNormalized?: number
  semanticConfidenceFactor?: number
  profileBoostRaw?: number
  profileBoostEffective?: number
  semanticPercentile?: number
  rawVectorRank?: number | null
  finalRank?: number | null
  rankDelta?: number | null
  final: number
  reasons: string[]
}

export type RecommendationCandidate = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
  title: string
  year: number | null
  posterPath: string | null
  score: number
  reasons: string[]
  source: RecommendationSource
  available: boolean
  scoreBreakdown?: ScoreBreakdown
}

export type RecommendationsResponse = {
  profileId: string
  coldStart: boolean
  candidates: RecommendationCandidate[]
  engineMetadata?: EngineMetadata
}
