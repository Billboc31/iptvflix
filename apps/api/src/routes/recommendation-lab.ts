import { createHash } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { LlmQueryPlannerService } from '../services/llm-query-planner-service.js'
import { createOpenAiPlannerProvider } from '../services/openai-llm-planner-provider.js'
import { OPENAI_API_KEY, LLM_PLANNER_MODEL } from '../config/env.js'
import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// In-process LRU cache for query plans (max 100 entries, 5-minute TTL)
// ---------------------------------------------------------------------------

interface CacheEntry {
  plan: RecommendationQueryPlan
  expiresAt: number
}

class PlanCache {
  private readonly map = new Map<string, CacheEntry>()
  private readonly maxSize: number
  private readonly ttlMs: number

  constructor(maxSize: number, ttlMs: number) {
    this.maxSize = maxSize
    this.ttlMs = ttlMs
  }

  get(key: string): RecommendationQueryPlan | undefined {
    const entry = this.map.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key)
      return undefined
    }
    // Move to end to maintain LRU order
    this.map.delete(key)
    this.map.set(key, entry)
    return entry.plan
  }

  set(key: string, plan: RecommendationQueryPlan): void {
    if (this.map.has(key)) this.map.delete(key)
    else if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest !== undefined) this.map.delete(oldest)
    }
    this.map.set(key, { plan, expiresAt: Date.now() + this.ttlMs })
  }
}

const planCache = new PlanCache(100, 5 * 60 * 1000)

function planCacheKey(rawQuery: string, profileContext: CompactTasteContext | null): string {
  const payload = rawQuery + '|' + JSON.stringify(profileContext ?? null)
  return createHash('sha256').update(payload).digest('hex')
}

// ---------------------------------------------------------------------------
// Planner service (singleton, null when no API key)
// ---------------------------------------------------------------------------

const plannerService = new LlmQueryPlannerService(
  OPENAI_API_KEY ? createOpenAiPlannerProvider(OPENAI_API_KEY, LLM_PLANNER_MODEL) : null,
)

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function recommendationLabRoutes(app: FastifyInstance): Promise<void> {
  app.post('/recommendation-lab/semantic-query', async (request, reply) => {
    if (!OPENAI_API_KEY) {
      return reply.status(503).send({ error: 'OPENAI_API_KEY not configured' })
    }

    const body = request.body as {
      query?: string
      topK?: number
      compareQuery?: string
      expandWithLlm?: boolean
      profileContext?: CompactTasteContext
    }

    const query = body?.query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({ error: 'query is required' })
    }

    const rawQuery = query.trim()
    const topK = Math.min(Math.max(1, Number(body?.topK ?? 10)), 50)
    const expandWithLlm = body?.expandWithLlm === true
    const profileContext = body?.profileContext ?? null

    const compareQuery = body?.compareQuery && typeof body.compareQuery === 'string'
      ? body.compareQuery.trim()
      : undefined

    const provider = createDefaultProvider(OPENAI_API_KEY)
    const embeddingService = new EmbeddingService(db, provider)
    const retrievalService = new SemanticRetrievalService(db, embeddingService)

    if (expandWithLlm) {
      // Check cache first
      const cacheKey = planCacheKey(rawQuery, profileContext)
      let plan = planCache.get(cacheKey)

      if (!plan) {
        plan = await plannerService.plan(rawQuery, profileContext)
        if (!plan.plannerFallback) {
          planCache.set(cacheKey, plan)
        }
      }

      // Path B: embed semanticIntent; Path A: embed raw query (compareResults)
      const effectiveCompareQuery = compareQuery ?? rawQuery
      const [expandedResults, rawResults] = await Promise.all([
        retrievalService.retrieve(rawQuery, topK, plan.semanticIntent),
        retrievalService.retrieve(effectiveCompareQuery, topK),
      ])

      // Apply mediaTypes filter from plan root (maxRuntimeMinutes omitted — runtime not in SemanticResult)
      const filteredTypes = plan.mediaTypes.length > 0 && plan.mediaTypes.length < 2
        ? new Set(plan.mediaTypes)
        : null

      const filteredResults = filteredTypes
        ? expandedResults.filter((r) => filteredTypes.has(r.mediaType))
        : expandedResults

      const mapResult = (r: (typeof filteredResults)[number]) => ({
        mediaId: r.mediaId,
        mediaType: r.mediaType,
        title: r.title,
        year: r.year,
        posterPath: r.posterPath,
        similarity: r.similarity,
        rank: r.rank,
        modelProvider: r.modelProvider,
        modelName: r.modelName,
      })

      return reply.send({
        query: rawQuery,
        topK,
        modelProvider: provider.modelProvider,
        modelName: provider.modelName,
        results: filteredResults.map(mapResult),
        compareQuery: effectiveCompareQuery,
        compareResults: rawResults.map(mapResult),
        queryPlan: plan,
      })
    }

    // Default path — unchanged behaviour
    const [primary, comparison] = await Promise.all([
      retrievalService.retrieve(rawQuery, topK),
      compareQuery ? retrievalService.retrieve(compareQuery, topK) : Promise.resolve(null),
    ])

    const mapResult = (r: (typeof primary)[number]) => ({
      mediaId: r.mediaId,
      mediaType: r.mediaType,
      title: r.title,
      year: r.year,
      posterPath: r.posterPath,
      similarity: r.similarity,
      rank: r.rank,
      modelProvider: r.modelProvider,
      modelName: r.modelName,
    })

    return reply.send({
      query: rawQuery,
      topK,
      modelProvider: provider.modelProvider,
      modelName: provider.modelName,
      results: primary.map(mapResult),
      ...(compareQuery && comparison
        ? {
            compareQuery,
            compareResults: comparison.map(mapResult),
          }
        : {}),
    })
  })
}
