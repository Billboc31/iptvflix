import OpenAI from 'openai'
import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { QUERY_PLAN_SCHEMA_VERSION } from '@iptvflix/api-contracts'
import type { LlmPlannerProvider } from './llm-planner-provider.js'
import { buildQueryPlannerPrompt } from '../prompts/query-planner-v1.js'

const PROMPT_VERSION = 'query-planner-v1'

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isMediaTypesArray(v: unknown): v is ('MOVIE' | 'SERIES')[] {
  return Array.isArray(v) && v.every((x) => x === 'MOVIE' || x === 'SERIES')
}

function validateAndNormalize(
  parsed: unknown,
  rawQuery: string,
  latencyMs: number,
  model: string,
): RecommendationQueryPlan {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('LLM response is not an object')
  }
  const p = parsed as Record<string, unknown>

  if (typeof p['semanticIntent'] !== 'string' || p['semanticIntent'].trim() === '') {
    throw new Error('semanticIntent missing or empty')
  }

  const hardFilters: RecommendationQueryPlan['hardFilters'] = {}
  const hf = p['hardFilters']
  if (hf && typeof hf === 'object') {
    const h = hf as Record<string, unknown>
    if (typeof h['maxRuntimeMinutes'] === 'number') hardFilters.maxRuntimeMinutes = h['maxRuntimeMinutes']
    if (typeof h['minReleaseYear'] === 'number') hardFilters.minReleaseYear = h['minReleaseYear']
    if (typeof h['maxReleaseYear'] === 'number') hardFilters.maxReleaseYear = h['maxReleaseYear']
    if (isStringArray(h['audioLanguages'])) hardFilters.audioLanguages = h['audioLanguages']
    if (isStringArray(h['includeGenres'])) hardFilters.includeGenres = h['includeGenres']
    if (isStringArray(h['excludeGenres'])) hardFilters.excludeGenres = h['excludeGenres']
  }

  const softPreferences: RecommendationQueryPlan['softPreferences'] = {}
  const sp = p['softPreferences']
  if (sp && typeof sp === 'object') {
    const s = sp as Record<string, unknown>
    if (isStringArray(s['preferredDecades'])) softPreferences.preferredDecades = s['preferredDecades']
    if (isStringArray(s['preferredDirectors'])) softPreferences.preferredDirectors = s['preferredDirectors']
    if (isStringArray(s['preferredLanguages'])) softPreferences.preferredLanguages = s['preferredLanguages']
  }

  const mediaTypes: ('MOVIE' | 'SERIES')[] = isMediaTypesArray(p['mediaTypes'])
    ? p['mediaTypes']
    : ['MOVIE', 'SERIES']

  return {
    schemaVersion: QUERY_PLAN_SCHEMA_VERSION,
    rawQuery,
    displayTitle: typeof p['displayTitle'] === 'string' && p['displayTitle'].trim()
      ? p['displayTitle'].trim()
      : rawQuery,
    semanticIntent: (p['semanticIntent'] as string).trim(),
    desiredThemes: isStringArray(p['desiredThemes']) ? p['desiredThemes'] : [],
    desiredTone: isStringArray(p['desiredTone']) ? p['desiredTone'] : [],
    avoidSignals: isStringArray(p['avoidSignals']) ? p['avoidSignals'] : [],
    mediaTypes,
    hardFilters,
    softPreferences,
    userConstraints: isStringArray(p['userConstraints']) ? p['userConstraints'] : [],
    plannerFallback: false,
    plannerMeta: {
      provider: 'openai',
      model,
      promptVersion: PROMPT_VERSION,
      latencyMs,
    },
  }
}

export class OpenAiLlmPlannerProvider implements LlmPlannerProvider {
  readonly provider = 'openai'
  readonly promptVersion = PROMPT_VERSION
  readonly model: string

  private readonly client: OpenAI

  constructor(apiKey: string, model: string) {
    this.model = model
    this.client = new OpenAI({ apiKey })
  }

  async planQuery(
    rawQuery: string,
    profileContext: CompactTasteContext | null,
  ): Promise<RecommendationQueryPlan> {
    const messages = buildQueryPlannerPrompt(rawQuery, profileContext)
    const start = Date.now()

    const response = await this.client.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 600,
      messages,
    })

    const latencyMs = Date.now() - start
    const content = response.choices[0]?.message?.content

    if (!content) {
      throw new Error('Empty response from LLM')
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error(`LLM response is not valid JSON: ${content.slice(0, 100)}`)
    }

    return validateAndNormalize(parsed, rawQuery, latencyMs, this.model)
  }
}

export function createOpenAiPlannerProvider(apiKey: string, model: string): OpenAiLlmPlannerProvider {
  return new OpenAiLlmPlannerProvider(apiKey, model)
}
