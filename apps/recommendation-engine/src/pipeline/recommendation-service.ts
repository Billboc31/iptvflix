import { desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies, series } from '../db/schema.js'
import { runTextSearch } from './stages/text-search.js'
import { runSemanticSearch } from './stages/semantic-search.js'
import { runHybridReranker, SCORE_MODEL_V2 } from './stages/hybrid-reranker.js'
import { EMBEDDING_MODEL_PROVIDER, EMBEDDING_MODEL_NAME, OPENAI_API_KEY } from '../config.js'
import type { QueryResponse, StageResult, StageAvailability, PipelineContext, CandidateItem, MediaType } from './types.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'
import type { FastifyBaseLogger } from 'fastify'

export const PIPELINE_VERSION = '1.0.0'

export type RecommendationOptions = {
  profileId?: string
  mediaTypes?: MediaType[]
  limit?: number
  candidatePoolSize?: number
  debug?: boolean
}

function mergeCandidates(textCandidates: CandidateItem[], semanticCandidates: CandidateItem[]): CandidateItem[] {
  const byId = new Map<string, CandidateItem>()
  for (const c of semanticCandidates) byId.set(c.id, c)
  for (const c of textCandidates) {
    if (!byId.has(c.id)) byId.set(c.id, { ...c, similarity: 0 })
  }
  return [...byId.values()]
}

async function fetchPopularityFallbackPool(mediaTypes: MediaType[], poolSize: number): Promise<CandidateItem[]> {
  const wantMovies = mediaTypes.includes('movie')
  const wantSeries = mediaTypes.includes('series')
  const candidates: CandidateItem[] = []

  if (wantMovies) {
    const rows = await db
      .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
      .from(movies)
      .orderBy(desc(movies.popularity), desc(movies.voteAverage))
      .limit(wantSeries ? Math.ceil(poolSize / 2) : poolSize)
    for (const r of rows) {
      candidates.push({ id: r.id, mediaType: 'movie', title: r.title, year: r.year ?? null, posterPath: r.posterPath ?? null, similarity: 0 })
    }
  }

  if (wantSeries) {
    const rows = await db
      .select({ id: series.id, title: series.title, year: series.firstAirYear, posterPath: series.posterPath })
      .from(series)
      .orderBy(desc(series.popularity), desc(series.voteAverage))
      .limit(wantMovies ? Math.floor(poolSize / 2) : poolSize)
    for (const r of rows) {
      candidates.push({ id: r.id, mediaType: 'series', title: r.title, year: r.year ?? null, posterPath: r.posterPath ?? null, similarity: 0 })
    }
  }

  return candidates
}

export async function runRecommendationFromPlan(
  plan: RecommendationQueryPlan,
  opts: RecommendationOptions,
  requestId: string,
  log: FastifyBaseLogger,
): Promise<QueryResponse> {
  const startedAt = Date.now()
  const mediaTypes = opts.mediaTypes ?? ['movie', 'series']
  const limit = opts.limit ?? 24
  const poolSize = opts.candidatePoolSize ?? 200

  const ctx: PipelineContext = {
    requestId,
    request: {
      text: plan.rawQuery ?? '',
      profileId: opts.profileId,
      mediaTypes,
      limit,
      debug: opts.debug,
    },
    startedAt,
    log,
    queryPlan: plan,
  }

  const stageOutputs: StageResult[] = []
  const stageAvailability: StageAvailability[] = []
  const fallbackFlags: string[] = []

  const hasSemanticIntent = plan.semanticIntent.trim() !== ''

  // Semantic retrieval — primary candidate source
  let semanticCandidates: CandidateItem[] = []
  if (hasSemanticIntent) {
    const semanticResult = await runSemanticSearch(ctx, [])
    stageOutputs.push(semanticResult)
    stageAvailability.push({ name: 'semantic-search', available: semanticResult.available, reason: semanticResult.reason })
    if (!semanticResult.available) fallbackFlags.push('semantic-search')
    semanticCandidates = semanticResult.candidates ?? []
  } else {
    stageAvailability.push({ name: 'semantic-search', available: false, reason: 'no semantic intent' })
    fallbackFlags.push('semantic-search')
  }

  // Text search — fallback when semantic unavailable and rawQuery is present
  let textCandidates: CandidateItem[] = []
  const hasText = (plan.rawQuery ?? '').trim() !== ''
  if (hasText && semanticCandidates.length === 0) {
    const textResult = await runTextSearch(ctx)
    stageOutputs.push(textResult)
    stageAvailability.push({ name: 'text-search', available: textResult.available, reason: textResult.reason })
    textCandidates = textResult.candidates ?? []
  }

  // Merge semantic + text candidates
  let mergedCandidates = mergeCandidates(textCandidates, semanticCandidates)

  // No retrieval results (cold-start or no embeddings): popularity pool for V2 scoring
  if (mergedCandidates.length === 0) {
    mergedCandidates = await fetchPopularityFallbackPool(mediaTypes, poolSize)
    stageAvailability.push({ name: 'popularity-fallback', available: true, reason: 'no retrieval results' })
    fallbackFlags.push('popularity-fallback')
  }

  // Hybrid reranker — profile-aware SCORE_MODEL_V2 scoring
  const rerankerResult = await runHybridReranker(ctx, mergedCandidates)
  stageOutputs.push(rerankerResult)
  stageAvailability.push({ name: 'hybrid-reranker', available: rerankerResult.available, reason: rerankerResult.reason })
  if (!rerankerResult.available) fallbackFlags.push('hybrid-reranker')

  const results = rerankerResult.available && (rerankerResult.candidates?.length ?? 0) > 0
    ? (rerankerResult.candidates ?? [])
    : mergedCandidates.slice(0, limit)

  const totalMs = Date.now() - startedAt
  const timingStages: Record<string, number> = {}
  for (const s of stageOutputs) timingStages[s.stage] = s.durationMs

  const embeddingModelVersion = OPENAI_API_KEY
    ? `${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}`
    : 'none'

  const plannerModelVersion = plan.plannerMeta
    ? `${plan.plannerMeta.provider}/${plan.plannerMeta.model}@${plan.plannerMeta.promptVersion}`
    : 'none'

  log.info(
    {
      requestId,
      totalMs,
      candidateCount: results.length,
      candidatePoolSize: mergedCandidates.length,
      enabledStages: stageAvailability.filter((s) => s.available).map((s) => s.name),
    },
    'recommendation-service complete',
  )

  return {
    requestId,
    results,
    stageOutputs: opts.debug ? stageOutputs : stageOutputs.map(({ candidates: _, ...s }) => s),
    stageAvailability,
    timing: { totalMs, stages: timingStages },
    meta: {
      pipelineVersion: PIPELINE_VERSION,
      enabledStages: stageAvailability.filter((s) => s.available).map((s) => s.name),
      query: plan.rawQuery ?? '',
      profileId: opts.profileId,
    },
    engineMetadata: {
      engineVersion: PIPELINE_VERSION,
      embeddingModelVersion,
      plannerModelVersion,
      rerankerVersion: SCORE_MODEL_V2.version,
      timingsMs: timingStages,
      fallbackFlags,
    },
    queryPlan: plan,
  }
}
