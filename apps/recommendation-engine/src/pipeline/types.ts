import type { FastifyBaseLogger } from 'fastify'
import type { RecommendationQueryPlan, EngineMetadata } from '@iptvflix/api-contracts'

export type MediaType = 'movie' | 'series'

export interface QueryRequest {
  text: string
  profileId?: string
  mediaTypes?: MediaType[]
  limit?: number
  debug?: boolean
}

export interface CandidateItem {
  id: string
  mediaType: MediaType
  title: string
  year?: number | null
  posterPath?: string | null
  score?: number
  similarity?: number
  reasons?: string[]
  scoreBreakdown?: Record<string, number>
  available?: boolean
}

export interface StageAvailability {
  name: string
  available: boolean
  reason?: string
}

export interface StageResult {
  stage: string
  available: boolean
  reason?: string
  durationMs: number
  inputCount: number
  outputCount: number
  candidates?: CandidateItem[]
}

export interface PipelineContext {
  requestId: string
  request: QueryRequest
  startedAt: number
  log: FastifyBaseLogger
  queryPlan?: RecommendationQueryPlan
}

export interface QueryResponse {
  requestId: string
  results: CandidateItem[]
  stageOutputs: StageResult[]
  stageAvailability: StageAvailability[]
  timing: {
    totalMs: number
    stages: Record<string, number>
  }
  meta: {
    pipelineVersion: string
    enabledStages: string[]
    query: string
    profileId?: string
  }
  engineMetadata: EngineMetadata
  queryPlan?: RecommendationQueryPlan
}
