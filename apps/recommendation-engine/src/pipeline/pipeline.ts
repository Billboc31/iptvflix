import { runLlmPlanner } from './stages/llm-planner.js'
import { OPENAI_API_KEY, LLM_PLANNER_MODEL } from '../config.js'
import { runRecommendationFromPlan, PIPELINE_VERSION } from './recommendation-service.js'
import type { QueryRequest, QueryResponse, PipelineContext } from './types.js'
import type { FastifyBaseLogger } from 'fastify'

export { PIPELINE_VERSION }

export async function runPipeline(
  request: QueryRequest,
  requestId: string,
  log: FastifyBaseLogger,
): Promise<QueryResponse> {
  const startedAt = Date.now()
  const ctx: PipelineContext = {
    requestId,
    request,
    startedAt,
    log,
  }

  // Stage 1: LLM planner — resolves query into a RecommendationQueryPlan (mutates ctx.queryPlan)
  const llmResult = await runLlmPlanner(ctx)
  const plannerFallback = llmResult.reason?.startsWith('fallback') ?? false

  // Stages 2–4: central recommendation pipeline with the resolved plan
  const serviceResult = await runRecommendationFromPlan(
    ctx.queryPlan!,
    {
      profileId: request.profileId,
      mediaTypes: request.mediaTypes,
      limit: request.limit,
      debug: request.debug,
    },
    requestId,
    log,
  )

  const plannerModelVersion = OPENAI_API_KEY
    ? `openai/${LLM_PLANNER_MODEL}@query-planner-v1`
    : 'fallback/raw-query'

  const totalMs = Date.now() - startedAt
  const timingStages = { 'llm-planner': llmResult.durationMs, ...serviceResult.timing.stages }

  const llmStageOutput = request.debug
    ? llmResult
    : { stage: llmResult.stage, available: llmResult.available, reason: llmResult.reason, durationMs: llmResult.durationMs, inputCount: llmResult.inputCount, outputCount: llmResult.outputCount }

  return {
    requestId,
    results: serviceResult.results,
    stageOutputs: [llmStageOutput, ...serviceResult.stageOutputs],
    stageAvailability: [
      { name: 'llm-planner', available: llmResult.available, reason: llmResult.reason },
      ...serviceResult.stageAvailability,
    ],
    timing: { totalMs, stages: timingStages },
    meta: {
      pipelineVersion: PIPELINE_VERSION,
      enabledStages: [
        ...(llmResult.available ? ['llm-planner'] : []),
        ...serviceResult.stageAvailability.filter((s) => s.available).map((s) => s.name),
      ],
      query: request.text,
      profileId: request.profileId,
    },
    engineMetadata: {
      ...serviceResult.engineMetadata,
      plannerModelVersion,
      fallbackFlags: [
        ...(plannerFallback ? ['llm-planner'] : []),
        ...serviceResult.engineMetadata.fallbackFlags,
      ],
    },
    queryPlan: ctx.queryPlan,
  }
}
