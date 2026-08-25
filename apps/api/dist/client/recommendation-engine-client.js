import { RECOMMENDATION_ENGINE_URL, RECOMMENDATION_PREVIEW_TIMEOUT_MS } from '../config/env.js';
const REQUEST_TIMEOUT_MS = 15_000;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_AFTER_MS = 30_000;
// Circuit state is shared across all engine endpoints. A burst of failures on
// any endpoint (e.g. shelf-concepts) will open the circuit for all endpoints
// for CIRCUIT_RESET_AFTER_MS. Acceptable for MVP; track under T111 if it
// becomes a problem in production.
let failureCount = 0;
let circuitOpenUntil = 0;
function isCircuitOpen() {
    if (circuitOpenUntil > 0 && Date.now() < circuitOpenUntil)
        return true;
    if (circuitOpenUntil > 0 && Date.now() >= circuitOpenUntil) {
        // Half-open: allow one attempt
        circuitOpenUntil = 0;
        failureCount = 0;
    }
    return false;
}
function recordSuccess() {
    failureCount = 0;
    circuitOpenUntil = 0;
}
function recordFailure() {
    failureCount++;
    if (failureCount >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_RESET_AFTER_MS;
    }
}
async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    }
    finally {
        clearTimeout(timer);
    }
}
export const RecommendationEngineClient = {
    isConfigured() {
        return Boolean(RECOMMENDATION_ENGINE_URL);
    },
    async query(params) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return null;
        try {
            const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                recordFailure();
                return null;
            }
            const data = (await response.json());
            recordSuccess();
            return data;
        }
        catch {
            recordFailure();
            return null;
        }
    },
    async personalized(params) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return null;
        try {
            const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/personalized`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                recordFailure();
                return null;
            }
            const data = (await response.json());
            recordSuccess();
            return data;
        }
        catch {
            recordFailure();
            return null;
        }
    },
    async generateShelfConcepts(params) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return null;
        try {
            const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                recordFailure();
                return null;
            }
            const data = (await response.json());
            recordSuccess();
            return data;
        }
        catch {
            recordFailure();
            return null;
        }
    },
    async getShelfConcepts(profileId) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return null;
        try {
            const url = new URL(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts`);
            url.searchParams.set('profileId', profileId);
            const response = await fetchWithTimeout(url.toString(), { method: 'GET' });
            if (!response.ok) {
                recordFailure();
                return null;
            }
            const data = (await response.json());
            recordSuccess();
            return data;
        }
        catch {
            recordFailure();
            return null;
        }
    },
    async shelfConceptFeedback(conceptId, signal) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return false;
        try {
            const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts/${conceptId}/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ signal }),
            });
            if (!response.ok) {
                recordFailure();
                return false;
            }
            recordSuccess();
            return true;
        }
        catch {
            recordFailure();
            return false;
        }
    },
    async generateShelfInstance(params) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return null;
        try {
            const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-instances/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(params),
            });
            if (!response.ok) {
                recordFailure();
                return null;
            }
            const data = (await response.json());
            recordSuccess();
            return data;
        }
        catch {
            recordFailure();
            return null;
        }
    },
    async queryForShelf(params) {
        const raw = await this.query({
            text: params.text,
            profileId: params.profileId,
            limit: params.limit,
            mediaTypes: params.mediaTypeFilter ? [params.mediaTypeFilter.toLowerCase()] : undefined,
            freshnessBoostDays: params.freshnessBoostDays,
        });
        if (!raw)
            return null;
        const meta = raw.engineMetadata;
        return {
            candidates: raw.results.map((r) => ({
                mediaId: r.id,
                mediaType: r.mediaType === 'movie' ? 'MOVIE' : 'SERIES',
                semanticScore: (r.scoreBreakdown?.semantic ?? 0),
                profileScore: (r.scoreBreakdown?.profileScore ?? 0),
                finalScore: r.score ?? 0,
                reasons: r.reasons ?? [],
                available: r.available ?? false,
                qualityPrior: (r.scoreBreakdown?.qualityPrior ?? 0),
                languageAffinity: (r.scoreBreakdown?.languageAffinity ?? 0),
            })),
            queryPlannerVersion: meta.plannerModelVersion ?? 'unknown',
            embeddingModelVersion: meta.embeddingModelVersion ?? 'unknown',
            rankerVersion: meta.rerankerVersion ?? 'unknown',
            candidateCount: raw.results.length,
        };
    },
    async previewShelfConcept(conceptId, body) {
        if (!RECOMMENDATION_ENGINE_URL)
            return { ok: false, kind: 'unreachable' };
        if (isCircuitOpen())
            return { ok: false, kind: 'circuit-open' };
        const endpoint = `${RECOMMENDATION_ENGINE_URL}/v1/shelf-concepts/${conceptId}/preview`;
        const startMs = Date.now();
        try {
            const response = await fetchWithTimeout(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, RECOMMENDATION_PREVIEW_TIMEOUT_MS);
            const durationMs = Date.now() - startMs;
            if (!response.ok) {
                const rawBody = await response.text().catch(() => '');
                const truncatedBody = rawBody.slice(0, 500);
                recordFailure();
                if (response.status === 404) {
                    console.error('[recommendation-engine] preview failed', { endpoint, status: 404, durationMs, kind: 'not-found', body: truncatedBody });
                    return { ok: false, kind: 'not-found', status: 404 };
                }
                console.error('[recommendation-engine] preview failed', { endpoint, status: response.status, durationMs, kind: 'server-error', body: truncatedBody });
                return { ok: false, kind: 'server-error', status: response.status, message: truncatedBody };
            }
            const data = (await response.json());
            recordSuccess();
            console.info('[recommendation-engine] preview succeeded', { endpoint, status: response.status, durationMs });
            return { ok: true, data };
        }
        catch (err) {
            const durationMs = Date.now() - startMs;
            recordFailure();
            if (err instanceof Error && err.name === 'AbortError') {
                console.error('[recommendation-engine] preview timed out', { endpoint, durationMs, kind: 'timeout' });
                return { ok: false, kind: 'timeout' };
            }
            const message = err instanceof Error ? err.message : String(err);
            console.error('[recommendation-engine] preview unreachable', { endpoint, durationMs, kind: 'unreachable', error: message });
            return { ok: false, kind: 'unreachable' };
        }
    },
    async refreshShelfInstance(shelfId, profileId) {
        if (!RECOMMENDATION_ENGINE_URL || isCircuitOpen())
            return null;
        try {
            const response = await fetchWithTimeout(`${RECOMMENDATION_ENGINE_URL}/v1/shelf-instances/${shelfId}/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId }),
            });
            if (!response.ok) {
                recordFailure();
                return null;
            }
            const data = (await response.json());
            recordSuccess();
            return data;
        }
        catch {
            recordFailure();
            return null;
        }
    },
};
//# sourceMappingURL=recommendation-engine-client.js.map