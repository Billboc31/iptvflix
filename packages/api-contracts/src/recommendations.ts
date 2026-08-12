export type RecommendationSource = 'LOCAL' | 'DISCOVERY'

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
}

export type RecommendationsResponse = {
  profileId: string
  coldStart: boolean
  candidates: RecommendationCandidate[]
}
