import OpenAI from 'openai'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { profileTaste } from '../../db/schema.js'
import { OPENAI_API_KEY, LLM_PLANNER_MODEL } from '../../config.js'
import { buildQueryPlannerPrompt } from '../../prompts/query-planner-v1.js'
import type { StageResult, PipelineContext } from '../types.js'
import type { CompactTasteContext, RecommendationQueryPlan } from '@iptvflix/api-contracts'

const QUERY_PLAN_SCHEMA_VERSION = '1' as const
const PROMPT_VERSION = 'query-planner-v1'
const TIMEOUT_MS = 8000

function rawQueryFallbackPlan(rawQuery: string): RecommendationQueryPlan {
  return {
    schemaVersion: QUERY_PLAN_SCHEMA_VERSION,
    rawQuery,
    displayTitle: rawQuery,
    semanticIntent: rawQuery,
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: ['MOVIE', 'SERIES'],
    hardFilters: {},
    softPreferences: {},
    userConstraints: [],
    plannerFallback: true,
    plannerMeta: null,
  }
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string')
}

function isMediaTypesArray(v: unknown): v is ('MOVIE' | 'SERIES')[] {
  return Array.isArray(v) && v.every((x) => x === 'MOVIE' || x === 'SERIES')
}

function parseAndNormalize(parsed: unknown, rawQuery: string, latencyMs: number, model: string): RecommendationQueryPlan {
  if (!parsed || typeof parsed !== 'object') throw new Error('LLM response is not an object')
  const p = parsed as Record<string, unknown>

  if (typeof p['semanticIntent'] !== 'string' || (p['semanticIntent'] as string).trim() === '') {
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
    displayTitle: typeof p['displayTitle'] === 'string' && (p['displayTitle'] as string).trim()
      ? (p['displayTitle'] as string).trim()
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
    plannerMeta: { provider: 'openai', model, promptVersion: PROMPT_VERSION, latencyMs },
  }
}

async function buildCompactContext(profileId: string): Promise<CompactTasteContext | null> {
  try {
    const [row] = await db
      .select({
        genreScores: profileTaste.genreScores,
        genreMeta: profileTaste.genreMeta,
        positiveMediaIds: profileTaste.positiveMediaIds,
        negativeMediaIds: profileTaste.negativeMediaIds,
      })
      .from(profileTaste)
      .where(eq(profileTaste.profileId, profileId))

    if (!row) return null

    const scores = (row.genreScores ?? {}) as Record<string, number>
    const meta = (row.genreMeta ?? {}) as Record<string, { name: string; slug: string }>

    const sortedGenreIds = Object.entries(scores)
      .filter(([, s]) => s > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id]) => id)

    const topGenres = sortedGenreIds.map((id) => meta[id]?.name ?? '').filter(Boolean)
    const topThemes = sortedGenreIds.slice(0, 3).map((id) => meta[id]?.slug ?? '').filter(Boolean)

    return {
      topGenres,
      topThemes,
      likedPeople: [],
      recentlyWatched: (row.positiveMediaIds ?? []).slice(0, 5),
      negativeSignals: (row.negativeMediaIds ?? []).slice(0, 3),
    }
  } catch {
    return null
  }
}

export async function runLlmPlanner(ctx: PipelineContext): Promise<StageResult> {
  const start = Date.now()

  if (!OPENAI_API_KEY) {
    const plan = rawQueryFallbackPlan(ctx.request.text)
    ctx.queryPlan = plan
    return {
      stage: 'llm-planner',
      available: false,
      reason: 'OPENAI_API_KEY not configured',
      durationMs: Date.now() - start,
      inputCount: 0,
      outputCount: 0,
    }
  }

  const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
  const profileContext = ctx.request.profileId
    ? await buildCompactContext(ctx.request.profileId)
    : null

  const messages = buildQueryPlannerPrompt(ctx.request.text, profileContext)

  try {
    const callStart = Date.now()
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM planner timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS),
    )
    const responsePromise = openai.chat.completions.create({
      model: LLM_PLANNER_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 600,
      messages,
    })

    const response = await Promise.race([responsePromise, timeoutPromise])
    const latencyMs = Date.now() - callStart
    const content = response.choices[0]?.message?.content

    if (!content) throw new Error('Empty response from LLM')

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      throw new Error(`LLM response is not valid JSON: ${content.slice(0, 100)}`)
    }

    const plan = parseAndNormalize(parsed, ctx.request.text, latencyMs, LLM_PLANNER_MODEL)

    if (!plan.semanticIntent || plan.semanticIntent.trim() === '') {
      ctx.log.warn({ requestId: ctx.requestId }, 'llm-planner: semanticIntent empty — falling back')
      ctx.queryPlan = rawQueryFallbackPlan(ctx.request.text)
      return {
        stage: 'llm-planner',
        available: true,
        reason: 'fallback: empty semanticIntent',
        durationMs: Date.now() - start,
        inputCount: 0,
        outputCount: 0,
      }
    }

    ctx.queryPlan = plan

    ctx.log.info(
      { requestId: ctx.requestId, stage: 'llm-planner', durationMs: Date.now() - start, model: LLM_PLANNER_MODEL },
      'stage complete',
    )

    return {
      stage: 'llm-planner',
      available: true,
      durationMs: Date.now() - start,
      inputCount: 0,
      outputCount: 0,
    }
  } catch (err) {
    ctx.log.warn({ requestId: ctx.requestId, err: (err as Error).message }, 'llm-planner failed — using fallback')
    ctx.queryPlan = rawQueryFallbackPlan(ctx.request.text)
    return {
      stage: 'llm-planner',
      available: true,
      reason: `fallback: ${(err as Error).message}`,
      durationMs: Date.now() - start,
      inputCount: 0,
      outputCount: 0,
    }
  }
}
