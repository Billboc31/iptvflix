import { runTextSearch } from './stages/text-search.js'
import { runSemanticSearch } from './stages/semantic-search.js'
import { runLlmPlanner } from './stages/llm-planner.js'
import type {
  QueryRequest,
  QueryResponse,
  StageResult,
  StageAvailability,
  PipelineContext,
} from './types.js'
import type { FastifyBaseLogger } from 'fastify'

export const PIPELINE_VERSION = '1.0.0'

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

  // LLM planner: transforms query text (stub)
  const llmResult = await runLlmPlanner(ctx)
  stageOutputs.push(llmResult)
  stageAvailability.push({ name: 'llm-planner', available: llmResult.available, reason: llmResult.reason })

  // Text search: baseline, always runs
  const textResult = await runTextSearch(ctx)
  stageOutputs.push(textResult)
  stageAvailability.push({ name: 'text-search', available: textResult.available, reason: textResult.reason })

  // Semantic search: stub, runs against text-search candidates
  const semanticResult = await runSemanticSearch(ctx, textResult.candidates ?? [])
  stageOutputs.push(semanticResult)
  stageAvailability.push({ name: 'semantic-search', available: semanticResult.available, reason: semanticResult.reason })

  // Final results come from text-search (only available baseline)
  const results = textResult.candidates ?? []

  const totalMs = Date.now() - ctx.startedAt
  const timingStages: Record<string, number> = {}
  for (const s of stageOutputs) {
    timingStages[s.stage] = s.durationMs
  }

  log.info(
    {
      requestId,
      totalMs,
      candidateCount: results.length,
      finalCount: results.length,
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
  }
}
