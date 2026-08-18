const ENGINE_URL = (import.meta.env.VITE_ENGINE_URL as string | undefined) ?? 'http://localhost:3001'

export interface QueryRequest {
  text: string
  profileId?: string
  mediaTypes?: ('movie' | 'series')[]
  limit?: number
  debug?: boolean
}

export interface CandidateItem {
  id: string
  mediaType: 'movie' | 'series'
  title: string
  year?: number | null
  posterPath?: string | null
  score?: number
  scoreBreakdown?: Record<string, number>
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

export interface StageAvailability {
  name: string
  available: boolean
  reason?: string
}

export interface QueryResponse {
  requestId: string
  results: CandidateItem[]
  stageOutputs: StageResult[]
  stageAvailability: StageAvailability[]
  timing: { totalMs: number; stages: Record<string, number> }
  meta: {
    pipelineVersion: string
    enabledStages: string[]
    query: string
    profileId?: string
  }
}

export async function queryEngine(req: QueryRequest): Promise<QueryResponse> {
  const res = await fetch(`${ENGINE_URL}/v1/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Engine error ${res.status}: ${text}`)
  }
  return res.json() as Promise<QueryResponse>
}
