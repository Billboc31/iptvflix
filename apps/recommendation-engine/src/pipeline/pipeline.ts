import { runTextSearch } from './stages/text-search.js'
import { runSemanticSearch } from './stages/semantic-search.js'
import { runLlmPlanner } from './stages/llm-planner.js'
import { runHybridReranker, SCORE_MODEL_V1 } from './stages/hybrid-reranker.js'
import { EMBEDDING_MODEL_PROVIDER, EMBEDDING_MODEL_NAME, LLM_PLANNER_MODEL, OPENAI_API_KEY } from '../config.js'
import type {
  QueryRequest,
  QueryResponse,
  StageResult,
  StageAvailability,
  PipelineContext,
  CandidateItem,
} from './types.js'
import type { FastifyBaseLogger } from 'fastify'

export const PIPELINE_VERSION = '1.0.0'

function mergeCandidates(textCandidates: CandidateItem[], semanticCandidates: CandidateItem[]): CandidateItem[] {
  const byId = new Map<string, CandidateItem>()

  // Semantic candidates carry similarity; add them first
  for (const c of semanticCandidates) {
    byId.set(c.id, c)
  }

  // Text candidates fill in what semantic missed (similarity=0)
  for (const c of textCandidates) {
    if (!byId.has(c.id)) {
      byId.set(c.id, { ...c, similarity: 0 })
    }
  }

  return [...byId.values()]
}

export async function runPipeline(
  request: QueryRequest,
  requestId: string,
  log: FastifyBaseLogger,
): Promise<QueryResponse> {
  const ctx: PipelineContext = {
    requestId,
    request,
    startedAt: Date.now(),
    log,
  }

  const stageOutputs: StageResult[] = []
  const stageAvailability: StageAvailability[] = []
  const fallbackFlags: string[] = []

  // Stage 1: LLM planner — sets ctx.queryPlan
  const llmResult = await runLlmPlanner(ctx)
  stageOutputs.push(llmResult)
  stageAvailability.push({ name: 'llm-planner', available: llmResult.available, reason: llmResult.reason })
  if (llmResult.reason?.startsWith('fallback')) fallbackFlags.push('llm-planner')

  // Stage 2: Text search — baseline keyword matching
  const textResult = await runTextSearch(ctx)
  stageOutputs.push(textResult)
  stageAvailability.push({ name: 'text-search', available: textResult.available, reason: textResult.reason })

  // Stage 3: Semantic search — vector similarity using semanticIntent from plan
  const semanticResult = await runSemanticSearch(ctx, textResult.candidates ?? [])
  stageOutputs.push(semanticResult)
  stageAvailability.push({ name: 'semantic-search', available: semanticResult.available, reason: semanticResult.reason })
  if (!semanticResult.available) fallbackFlags.push('semantic-search')

  // Merge text + semantic candidates
  const merged = mergeCandidates(
    textResult.candidates ?? [],
    semanticResult.candidates ?? [],
  )

  // Stage 4: Hybrid reranker — profile-aware scoring
  const rerankerResult = await runHybridReranker(ctx, merged)
  stageOutputs.push(rerankerResult)
  stageAvailability.push({ name: 'hybrid-reranker', available: rerankerResult.available, reason: rerankerResult.reason })
  if (!rerankerResult.available) fallbackFlags.push('hybrid-reranker')

  // Final results: prefer reranker output, fall back to text search
  const results = rerankerResult.available && (rerankerResult.candidates?.length ?? 0) > 0
    ? (rerankerResult.candidates ?? [])
    : (textResult.candidates ?? []).slice(0, request.limit ?? 24)

  const totalMs = Date.now() - ctx.startedAt
  const timingStages: Record<string, number> = {}
  for (const s of stageOutputs) {
    timingStages[s.stage] = s.durationMs
  }

  const plannerModelVersion = OPENAI_API_KEY
    ? `openai/${LLM_PLANNER_MODEL}@query-planner-v1`
    : 'fallback/raw-query'

  const embeddingModelVersion = OPENAI_API_KEY
    ? `${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}`
    : 'none'

  log.info(
    {
      requestId,
      totalMs,
      candidateCount: results.length,
      enabledStages: stageAvailability.filter((s) => s.available).map((s) => s.name),
    },
    'pipeline complete',
  )

  return {
    requestId,
    results,
    stageOutputs: request.debug ? stageOutputs : stageOutputs.map(({ candidates: _, ...s }) => s),
    stageAvailability,
    timing: { totalMs, stages: timingStages },
    meta: {
      pipelineVersion: PIPELINE_VERSION,
      enabledStages: stageAvailability.filter((s) => s.available).map((s) => s.name),
      query: request.text,
      profileId: request.profileId,
    },
    engineMetadata: {
      engineVersion: PIPELINE_VERSION,
      embeddingModelVersion,
      plannerModelVersion,
      rerankerVersion: SCORE_MODEL_V1.version,
      timingsMs: timingStages,
      fallbackFlags,
    },
    queryPlan: ctx.queryPlan,
  }
}
