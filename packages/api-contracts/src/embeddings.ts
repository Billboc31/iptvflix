import type { CompactTasteContext, RecommendationQueryPlan } from './query-plan.js'
export type { CompactTasteContext } from './query-plan.js'
import type { EngineMetadata } from './engine-metadata.js'

export interface SemanticCandidate {
  mediaId: string
  mediaType: 'MOVIE' | 'SERIES'
  title: string
  year: number | null
  posterPath: string | null
  similarity: number
  rank: number
  modelProvider: string
  modelName: string
}

export interface SemanticQueryRequest {
  query: string
  topK?: number
  compareQuery?: string
  expandWithLlm?: boolean
  profileContext?: CompactTasteContext
}

export interface SemanticQueryResponse {
  query: string
  topK: number
  modelProvider: string
  modelName: string
  results: SemanticCandidate[]
  compareQuery?: string
  compareResults?: SemanticCandidate[]
  queryPlan?: RecommendationQueryPlan
  engineMetadata?: EngineMetadata
}
