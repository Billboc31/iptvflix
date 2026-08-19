import type { EngineMetadata, RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { RECOMMENDATION_ENGINE_URL } from '../config/env.js'

const REQUEST_TIMEOUT_MS = 15_000
const CIRCUIT_FAILURE_THRESHOLD = 3
const CIRCUIT_RESET_AFTER_MS = 30_000

// Circuit state is shared across all engine endpoints. A burst of failures on
// any endpoint (e.g. shelf-concepts) will open the circuit for all endpoints
// for CIRCUIT_RESET_AFTER_MS. Acceptable for MVP; track under T111 if it
// becomes a problem in production.
let failureCount = 0
let circuitOpenUntil = 0

function isCircuitOpen(): boolean {
  if (circuitOpenUntil > 0 && Date.now() < circuitOpenUntil) return true
  if (circuitOpenUntil > 0 && Date.now() >= circuitOpenUntil) {
    // Half-open: allow one attempt
    circuitOpenUntil = 0
    failureCount = 0
  }
  return false
}

function recordSuccess(): void {
  failureCount = 0
  circuitOpenUntil = 0
}

function recordFailure(): void {
  failureCount++
  if (failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
    circuitOpenUntil = Date.now() + CIRCUIT_RESET_AFTER_MS
  }
}

async function fetchWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export interface EngineQueryResult {
  requestId: string
  results: Array<{
    id: string
    mediaType: 'movie' | 'series'
    title: string
    year?: number | null
    posterPath?: string | null
    score?: number
    reasons?: string[]
    scoreBreakdown?: Record<string, number>
    available?: boolean
  }>
  engineMetadata: EngineMetadata
  queryPlan?: RecommendationQueryPlan
}

export interface ShelfCandidateItem {
  mediaId: string
  mediaType: 'MOVIE' | 'SERIES'
  semanticScore: number
  profileScore: number
  finalScore: number
  reasons: string[]
  available: boolean
}

export interface ShelfQueryResult {
  candidates: ShelfCandidateItem[]
  queryPlannerVersion: string
  embeddingModelVersion: string
  rankerVersion: string
  candidateCount: number
}

export interface EnginePersonalizedResult {
  requestId: string
  results: Array<{
    id: string
    mediaType: 'movie' | 'series'
    title: string
    year?: number | null
    posterPath?: string | null
    score?: number
    reasons?: string[]
  }>
  engineMetadata: EngineMetadata
}

export interface EngineShelfConceptsResult {
  concepts: unknown[]
  coldStart: boolean
  profileContext: unknown
}

export interface EngineShelfInstanceResult {
  shelf: { id: string; title: string; type: string; layoutHint: string; position: number }
  explanation: { inferredGenreIds: string[]; seedTitles: string[]; generatedAt: string }
}

export const RecommendationEngineClient = {
  isConfigured(): boolean {
    return Boolean(RECOMMENDATION_ENGINE_URL)
  },

  async query(params: {
    text: string
    profileId?: string
    mediaTypes?: ('movie' | 'series')[]
    limit?: number
    debug?: boolean
  }): Promise<EngineQueryResult | null> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return null

    try {
      const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        recordFailure()
        return null
      }

      const data = (await response.json()) as EngineQueryResult
      recordSuccess()
      return data
    } catch {
      recordFailure()
      return null
    }
  },

  async personalized(params: {
    profileId: string
    mediaTypes?: ('movie' | 'series')[]
    limit?: number
  }): Promise<EnginePersonalizedResult | null> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return null

    try {
      const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/personalized`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        recordFailure()
        return null
      }

      const data = (await response.json()) as EnginePersonalizedResult
      recordSuccess()
      return data
    } catch {
      recordFailure()
      return null
    }
  },

  async generateShelfConcepts(params: { profileId: string; count?: number }): Promise<EngineShelfConceptsResult | null> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return null

    try {
      const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) { recordFailure(); return null }
      const data = (await response.json()) as EngineShelfConceptsResult
      recordSuccess()
      return data
    } catch {
      recordFailure()
      return null
    }
  },

  async getShelfConcepts(profileId: string): Promise<unknown[] | null> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return null

    try {
      const url = new URL(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts`)
      url.searchParams.set('profileId', profileId)
      const response = await fetchWithTimeout(url.toString(), { method: 'GET' })
      if (!response.ok) { recordFailure(); return null }
      const data = (await response.json()) as unknown[]
      recordSuccess()
      return data
    } catch {
      recordFailure()
      return null
    }
  },

  async shelfConceptFeedback(conceptId: string, signal: 'good' | 'bad'): Promise<boolean> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return false

    try {
      const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts/${conceptId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signal }),
      })
      if (!response.ok) { recordFailure(); return false }
      recordSuccess()
      return true
    } catch {
      recordFailure()
      return false
    }
  },

  async generateShelfInstance(params: { profileId: string; [key: string]: unknown }): Promise<EngineShelfInstanceResult | null> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return null

    try {
      const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-instances/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) { recordFailure(); return null }
      const data = (await response.json()) as EngineShelfInstanceResult
      recordSuccess()
      return data
    } catch {
      recordFailure()
      return null
    }
  },

  async queryForShelf(params: {
    text: string
    profileId: string
    limit: number
  }): Promise<ShelfQueryResult | null> {
    const raw = await this.query({ text: params.text, profileId: params.profileId, limit: params.limit })
    if (!raw) return null

    const meta = raw.engineMetadata
    return {
      candidates: raw.results.map((r) => ({
        mediaId: r.id,
        mediaType: r.mediaType === 'movie' ? 'MOVIE' : 'SERIES',
        semanticScore: (r.scoreBreakdown?.semantic ?? 0) as number,
        profileScore: (r.scoreBreakdown?.profileScore ?? 0) as number,
        finalScore: r.score ?? 0,
        reasons: r.reasons ?? [],
        available: r.available ?? false,
      })),
      queryPlannerVersion: meta.plannerModelVersion ?? 'unknown',
      embeddingModelVersion: meta.embeddingModelVersion ?? 'unknown',
      rankerVersion: meta.rerankerVersion ?? 'unknown',
      candidateCount: raw.results.length,
    }
  },

  async refreshShelfInstance(shelfId: string, profileId: string): Promise<EngineShelfInstanceResult | null> {
    if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen()) return null

    try {
      const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-instances/${shelfId}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })
      if (!response.ok) { recordFailure(); return null }
      const data = (await response.json()) as EngineShelfInstanceResult
      recordSuccess()
      return data
    } catch {
      recordFailure()
      return null
    }
  },
}
