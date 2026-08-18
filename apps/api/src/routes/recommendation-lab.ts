import { createHash } from 'node:crypto'
import { eq, and, inArray } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/client.js'
import {
  profileTaste,
  movieGenres,
  seriesGenres,
  movieAvailabilities,
  seriesAvailabilities,
  genres,
} from '../db/schema/index.js'
import { EmbeddingService } from '../services/embedding-service.js'
import { SemanticRetrievalService } from '../services/semantic-retrieval-service.js'
import type { SemanticResult } from '../services/semantic-retrieval-service.js'
import { createDefaultProvider } from '../services/embedding-provider.js'
import { LlmQueryPlannerService } from '../services/llm-query-planner-service.js'
import { createOpenAiPlannerProvider } from '../services/openai-llm-planner-provider.js'
import { OPENAI_API_KEY, LLM_PLANNER_MODEL } from '../config/env.js'
import {
  rankHybrid,
  SCORE_MODEL_V1,
} from '../services/recommendation-ranking-service.js'
import type {
  HybridCandidate,
  TasteSignals,
  RankingOptions,
  ExplorationLevel,
} from '../services/recommendation-ranking-service.js'
import type {
  CompactTasteContext,
  RecommendationQueryPlan,
  RecommendationCandidate,
} from '@iptvflix/api-contracts'
import { rawQueryFallbackPlan } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// profileContext sanitisation — validate shape and bound string lengths
// to prevent prompt-injection via caller-controlled context fields.
// ---------------------------------------------------------------------------

const PROFILE_MAX_ITEMS = 20
const PROFILE_MAX_ITEM_LEN = 100

function sanitizeStringArray(field: unknown): string[] {
  if (!Array.isArray(field)) return []
  return (field as unknown[])
    .filter((item): item is string => typeof item === 'string')
    .slice(0, PROFILE_MAX_ITEMS)
    .map((s) => s.slice(0, PROFILE_MAX_ITEM_LEN))
}

function sanitizeProfileContext(raw: unknown): CompactTasteContext | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  return {
    topGenres: sanitizeStringArray(obj.topGenres),
    topThemes: sanitizeStringArray(obj.topThemes),
    likedPeople: sanitizeStringArray(obj.likedPeople),
    recentlyWatched: sanitizeStringArray(obj.recentlyWatched),
    negativeSignals: sanitizeStringArray(obj.negativeSignals),
  }
}

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
// Hybrid enrichment helpers
// ---------------------------------------------------------------------------

async function loadTasteSignals(profileId: string): Promise<TasteSignals | null> {
  const rows = await db
    .select()
    .from(profileTaste)
    .where(eq(profileTaste.profileId, profileId))

  const row = rows[0]
  if (!row) return null

  const genreScores = (row.genreScores ?? {}) as Record<string, number>
  const genreMeta = (row.genreMeta ?? {}) as Record<string, { name: string }>
  const genreNames: Record<string, string> = {}
  for (const [id, meta] of Object.entries(genreMeta)) {
    genreNames[id] = meta.name
  }

  return {
    genreScores,
    genreNames,
    positiveMediaIds: new Set<string>(row.positiveMediaIds ?? []),
    negativeMediaIds: new Set<string>(row.negativeMediaIds ?? []),
    signalCount: row.signalCount ?? 0,
  }
}

async function enrichAsHybridCandidates(results: SemanticResult[]): Promise<HybridCandidate[]> {
  if (results.length === 0) return []

  const movieIds = results.filter((r) => r.mediaType === 'MOVIE').map((r) => r.mediaId)
  const seriesIds = results.filter((r) => r.mediaType === 'SERIES').map((r) => r.mediaId)

  const [
    movieGenreRows,
    seriesGenreRows,
    allGenreRows,
    availMovieRows,
    availSeriesRows,
  ] = await Promise.all([
    movieIds.length > 0
      ? db
          .select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId })
          .from(movieGenres)
          .where(inArray(movieGenres.movieId, movieIds))
      : Promise.resolve([] as { movieId: string; genreId: string }[]),
    seriesIds.length > 0
      ? db
          .select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId })
          .from(seriesGenres)
          .where(inArray(seriesGenres.seriesId, seriesIds))
      : Promise.resolve([] as { seriesId: string; genreId: string }[]),
    db.select({ id: genres.id, name: genres.name }).from(genres),
    movieIds.length > 0
      ? db
          .select({ movieId: movieAvailabilities.movieId })
          .from(movieAvailabilities)
          .where(
            and(
              inArray(movieAvailabilities.movieId, movieIds),
              eq(movieAvailabilities.status, 'AVAILABLE'),
            ),
          )
      : Promise.resolve([] as { movieId: string }[]),
    seriesIds.length > 0
      ? db
          .select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(
            and(
              inArray(seriesAvailabilities.seriesId, seriesIds),
              eq(seriesAvailabilities.status, 'AVAILABLE'),
            ),
          )
      : Promise.resolve([] as { seriesId: string }[]),
  ])

  const genreNameMap = new Map(allGenreRows.map((g) => [g.id, g.name]))

  const movieGenreMap = new Map<string, string[]>()
  for (const { movieId, genreId } of movieGenreRows) {
    const list = movieGenreMap.get(movieId) ?? []
    list.push(genreId)
    movieGenreMap.set(movieId, list)
  }

  const seriesGenreMap = new Map<string, string[]>()
  for (const { seriesId, genreId } of seriesGenreRows) {
    const list = seriesGenreMap.get(seriesId) ?? []
    list.push(genreId)
    seriesGenreMap.set(seriesId, list)
  }

  const availMovieSet = new Set(availMovieRows.map((r) => r.movieId))
  const availSeriesSet = new Set(availSeriesRows.map((r) => r.seriesId))

  return results.map((r) => {
    const genreIds =
      r.mediaType === 'MOVIE'
        ? (movieGenreMap.get(r.mediaId) ?? [])
        : (seriesGenreMap.get(r.mediaId) ?? [])

    const genreNames = genreIds.map((id) => genreNameMap.get(id) ?? '').filter(Boolean)
    const available =
      r.mediaType === 'MOVIE' ? availMovieSet.has(r.mediaId) : availSeriesSet.has(r.mediaId)

    return {
      mediaId: r.mediaId,
      mediaType: r.mediaType as 'MOVIE' | 'SERIES',
      title: r.title,
      year: r.year,
      posterPath: r.posterPath,
      source: 'LOCAL' as const,
      similarity: r.similarity,
      genreIds,
      genreNames,
      popularity: null,
      voteAverage: null,
      available,
      status: null,
      collectionId: null,
      directors: [],
      keywords: [],
      durationMinutes: null,
      originalLanguage: null,
      completionRatio: null,
    }
  })
}

function mapScoredToCandidate(
  c: ReturnType<typeof rankHybrid>[number],
): RecommendationCandidate {
  return {
    mediaType: c.mediaType,
    mediaId: c.mediaId,
    title: c.title,
    year: c.year,
    posterPath: c.posterPath,
    score: c.score,
    reasons: c.reasons,
    source: c.source,
    available: c.available,
    scoreBreakdown: c.scoreBreakdown,
  }
}

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
      // Hybrid ranking extensions
      useHybridRanking?: boolean
      profileId?: string
      compareProfileId?: string
      explorationLevel?: ExplorationLevel
      diversityEnabled?: boolean
      alreadyShownIds?: string[]
      debug?: boolean
    }

    const query = body?.query
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return reply.status(400).send({ error: 'query is required' })
    }

    const rawQuery = query.trim()
    if (rawQuery.length > 500) {
      return reply.status(400).send({ error: 'query must not exceed 500 characters' })
    }
    const topK = Math.min(Math.max(1, Number(body?.topK ?? 10)), 50)
    const expandWithLlm = body?.expandWithLlm === true
    const profileContext = sanitizeProfileContext(body?.profileContext)

    const compareQuery =
      body?.compareQuery && typeof body.compareQuery === 'string'
        ? body.compareQuery.trim()
        : undefined

    const useHybridRanking = body?.useHybridRanking === true
    const profileId = typeof body?.profileId === 'string' ? body.profileId : undefined
    const compareProfileId =
      typeof body?.compareProfileId === 'string' ? body.compareProfileId : undefined
    const explorationLevel: ExplorationLevel =
      body?.explorationLevel === 'explore' || body?.explorationLevel === 'discover'
        ? body.explorationLevel
        : 'exploit'
    const diversityEnabled = body?.diversityEnabled !== false
    const alreadyShownIds = Array.isArray(body?.alreadyShownIds)
      ? (body.alreadyShownIds as unknown[]).filter((x): x is string => typeof x === 'string')
      : []
    const debugMode = body?.debug === true

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

      // Apply hard filters available in SemanticResult.
      // Enforced: mediaTypes, minReleaseYear, maxReleaseYear (year field present after enrichWithMetadata).
      // NOT enforced (no genre/audio data in SemanticResult): excludeGenres, includeGenres,
      // audioLanguages, maxRuntimeMinutes — shown in QueryPlanPanel as unenforced.
      const filteredTypes =
        plan.mediaTypes.length > 0 && plan.mediaTypes.length < 2
          ? new Set(plan.mediaTypes)
          : null

      const { minReleaseYear, maxReleaseYear } = plan.hardFilters

      const filteredResults = expandedResults.filter((r) => {
        if (filteredTypes && !filteredTypes.has(r.mediaType)) return false
        if (minReleaseYear !== undefined && r.year !== null && r.year < minReleaseYear) return false
        if (maxReleaseYear !== undefined && r.year !== null && r.year > maxReleaseYear) return false
        return true
      })

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

      // Hybrid ranking block
      let hybridResults: RecommendationCandidate[] | undefined
      let compareProfileHybridResults: RecommendationCandidate[] | undefined

      if (useHybridRanking) {
        const rankingOpts: RankingOptions = {
          limit: topK,
          explorationLevel,
          diversityEnabled,
          alreadyShownIds,
          debug: debugMode,
        }

        const [enriched, taste1, taste2] = await Promise.all([
          enrichAsHybridCandidates(filteredResults),
          profileId ? loadTasteSignals(profileId) : Promise.resolve(null),
          compareProfileId ? loadTasteSignals(compareProfileId) : Promise.resolve(null),
        ])

        hybridResults = rankHybrid(enriched, plan, taste1, rankingOpts).map(mapScoredToCandidate)

        if (compareProfileId && taste2 !== undefined) {
          compareProfileHybridResults = rankHybrid(enriched, plan, taste2, rankingOpts).map(
            mapScoredToCandidate,
          )
        }
      }

      return reply.send({
        query: rawQuery,
        topK,
        modelProvider: provider.modelProvider,
        modelName: provider.modelName,
        results: filteredResults.map(mapResult),
        compareQuery: effectiveCompareQuery,
        compareResults: rawResults.map(mapResult),
        queryPlan: plan,
        ...(hybridResults !== undefined ? { hybridResults } : {}),
        ...(compareProfileHybridResults !== undefined
          ? { compareProfileHybridResults }
          : {}),
        ...(debugMode ? { scoreModel: SCORE_MODEL_V1 } : {}),
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

    // Hybrid ranking on default (no LLM) path
    let hybridResults: RecommendationCandidate[] | undefined
    let compareProfileHybridResults: RecommendationCandidate[] | undefined

    if (useHybridRanking) {
      const fallbackPlan = rawQueryFallbackPlan(rawQuery)
      const rankingOpts: RankingOptions = {
        limit: topK,
        explorationLevel,
        diversityEnabled,
        alreadyShownIds,
        debug: debugMode,
      }

      const [enriched, taste1, taste2] = await Promise.all([
        enrichAsHybridCandidates(primary),
        profileId ? loadTasteSignals(profileId) : Promise.resolve(null),
        compareProfileId ? loadTasteSignals(compareProfileId) : Promise.resolve(null),
      ])

      hybridResults = rankHybrid(enriched, fallbackPlan, taste1, rankingOpts).map(
        mapScoredToCandidate,
      )

      if (compareProfileId && taste2 !== undefined) {
        compareProfileHybridResults = rankHybrid(enriched, fallbackPlan, taste2, rankingOpts).map(
          mapScoredToCandidate,
        )
      }
    }

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
      ...(hybridResults !== undefined ? { hybridResults } : {}),
      ...(compareProfileHybridResults !== undefined ? { compareProfileHybridResults } : {}),
      ...(debugMode ? { scoreModel: SCORE_MODEL_V1 } : {}),
    })
  })
}
