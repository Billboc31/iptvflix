import type { EngineMetadata } from './engine-metadata.js'

export type RecommendationSource = 'LOCAL' | 'DISCOVERY'

export interface ScoreBreakdown {
  modelVersion: string
  semantic: number
  genreAffinity: number
  themeAffinity: number
  peopleAffinity: number
  qualityPrior: number
  freshness: number
  availabilityBonus: number
  alreadyWatchedPenalty: number
  abandonPenalty: number
  dislikedPenalty: number
  avoidPenalty: number
  repetitionPenalty: number
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
