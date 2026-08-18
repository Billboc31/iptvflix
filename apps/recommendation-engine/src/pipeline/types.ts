import type { FastifyBaseLogger } from 'fastify'

export type MediaType = 'movie' | 'series'

export interface QueryRequest {
  text: string
  profileId?: string
  mediaTypes?: MediaType[]
  limit?: number
  debug?: boolean
  stages?: {
    textSearch?: boolean
    semanticSearch?: boolean
    llmPlanner?: boolean
  }
}

export interface CandidateItem {
  id: string
  mediaType: MediaType
  title: string
  year?: number | null
  posterPath?: string | null
  score?: number
  scoreBreakdown?: Record<string, number>
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
}
