import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { rawQueryFallbackPlan } from '@iptvflix/api-contracts'
import type { LlmPlannerProvider } from './llm-planner-provider.js'

const TIMEOUT_MS = 8000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(`LLM planner timed out after ${ms}ms`)), ms),
  )
  return Promise.race([promise, timeout])
}

export class LlmQueryPlannerService {
  constructor(private readonly provider: LlmPlannerProvider | null) {}

  async plan(
    rawQuery: string,
    profileContext: CompactTasteContext | null,
  ): Promise<RecommendationQueryPlan> {
    if (!this.provider) {
      return rawQueryFallbackPlan(rawQuery)
    }

    try {
      const result = await withTimeout(
        this.provider.planQuery(rawQuery, profileContext),
        TIMEOUT_MS,
      )

      if (!result.semanticIntent || result.semanticIntent.trim() === '') {
        console.warn('[LlmQueryPlannerService] semanticIntent is empty — falling back to raw query')
        return rawQueryFallbackPlan(rawQuery)
      }

      return result
    } catch (err) {
      console.warn('[LlmQueryPlannerService] planner failed, using fallback:', (err as Error).message)
      return rawQueryFallbackPlan(rawQuery)
    }
  }
}
