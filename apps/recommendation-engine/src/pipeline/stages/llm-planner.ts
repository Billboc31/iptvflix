import { OPENAI_API_KEY } from '../../config.js'
import type { StageResult, PipelineContext } from '../types.js'

export async function runLlmPlanner(ctx: PipelineContext): Promise<StageResult> {
  const start = Date.now()

  if (!OPENAI_API_KEY) {
    return {
      stage: 'llm-planner',
      available: false,
      reason: 'OPENAI_API_KEY not configured',
      durationMs: Date.now() - start,
      inputCount: 0,
      outputCount: 0,
    }
  }

  // LLM query expansion not yet implemented
  return {
    stage: 'llm-planner',
    available: false,
    reason: 'LLM query planning not yet implemented',
    durationMs: Date.now() - start,
    inputCount: 0,
    outputCount: 0,
  }
}
