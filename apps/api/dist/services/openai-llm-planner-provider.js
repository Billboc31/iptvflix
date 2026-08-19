// @deprecated — use recommendation-engine (apps/recommendation-engine/src/pipeline/stages/llm-planner.ts)
import OpenAI from 'openai';
import { QUERY_PLAN_SCHEMA_VERSION } from '../query-plan-fallback.js';
import { buildQueryPlannerPrompt } from '../prompts/query-planner-v1.js';
const PROMPT_VERSION = 'query-planner-v1';
function isStringArray(v) {
    return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function isMediaTypesArray(v) {
    return Array.isArray(v) && v.every((x) => x === 'MOVIE' || x === 'SERIES');
}
function validateAndNormalize(parsed, rawQuery, latencyMs, model) {
    if (!parsed || typeof parsed !== 'object') {
        throw new Error('LLM response is not an object');
    }
    const p = parsed;
    if (typeof p['semanticIntent'] !== 'string' || p['semanticIntent'].trim() === '') {
        throw new Error('semanticIntent missing or empty');
    }
    const hardFilters = {};
    const hf = p['hardFilters'];
    if (hf && typeof hf === 'object') {
        const h = hf;
        if (typeof h['maxRuntimeMinutes'] === 'number')
            hardFilters.maxRuntimeMinutes = h['maxRuntimeMinutes'];
        if (typeof h['minReleaseYear'] === 'number')
            hardFilters.minReleaseYear = h['minReleaseYear'];
        if (typeof h['maxReleaseYear'] === 'number')
            hardFilters.maxReleaseYear = h['maxReleaseYear'];
        if (isStringArray(h['audioLanguages']))
            hardFilters.audioLanguages = h['audioLanguages'];
        if (isStringArray(h['includeGenres']))
            hardFilters.includeGenres = h['includeGenres'];
        if (isStringArray(h['excludeGenres']))
            hardFilters.excludeGenres = h['excludeGenres'];
    }
    const softPreferences = {};
    const sp = p['softPreferences'];
    if (sp && typeof sp === 'object') {
        const s = sp;
        if (isStringArray(s['preferredDecades']))
            softPreferences.preferredDecades = s['preferredDecades'];
        if (isStringArray(s['preferredDirectors']))
            softPreferences.preferredDirectors = s['preferredDirectors'];
        if (isStringArray(s['preferredLanguages']))
            softPreferences.preferredLanguages = s['preferredLanguages'];
    }
    const mediaTypes = isMediaTypesArray(p['mediaTypes'])
        ? p['mediaTypes']
        : ['MOVIE', 'SERIES'];
    return {
        schemaVersion: QUERY_PLAN_SCHEMA_VERSION,
        rawQuery,
        displayTitle: typeof p['displayTitle'] === 'string' && p['displayTitle'].trim()
            ? p['displayTitle'].trim()
            : rawQuery,
        semanticIntent: p['semanticIntent'].trim(),
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
    };
}
export class OpenAiLlmPlannerProvider {
    provider = 'openai';
    promptVersion = PROMPT_VERSION;
    model;
    client;
    constructor(apiKey, model) {
        this.model = model;
        this.client = new OpenAI({ apiKey });
    }
    async planQuery(rawQuery, profileContext) {
        const messages = buildQueryPlannerPrompt(rawQuery, profileContext);
        const start = Date.now();
        const response = await this.client.chat.completions.create({
            model: this.model,
            response_format: { type: 'json_object' },
            temperature: 0.1,
            max_tokens: 600,
            messages,
        });
        const latencyMs = Date.now() - start;
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from LLM');
        }
        let parsed;
        try {
            parsed = JSON.parse(content);
        }
        catch {
            throw new Error(`LLM response is not valid JSON: ${content.slice(0, 100)}`);
        }
        return validateAndNormalize(parsed, rawQuery, latencyMs, this.model);
    }
}
export function createOpenAiPlannerProvider(apiKey, model) {
    return new OpenAiLlmPlannerProvider(apiKey, model);
}
//# sourceMappingURL=openai-llm-planner-provider.js.map