import { TheIntroDbRateLimitError, TheIntroDbNetworkError } from './errors.js';
import { mapTheIntroDbResponse } from './mapper.js';
const DEFAULT_BASE_URL = 'https://api.theintrodb.org/v3';
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 60_000;
const DEFAULT_RATE_LIMIT_WARN_THRESHOLD = 10;
export class TheIntroDbClient {
    baseUrl;
    timeoutMs;
    rateLimitWarnThreshold;
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
        this.timeoutMs = config.timeoutMs ?? 10_000;
        this.rateLimitWarnThreshold = config.rateLimitWarnThreshold ?? DEFAULT_RATE_LIMIT_WARN_THRESHOLD;
    }
    async fetchEpisodeSegments(episode) {
        if (episode.seriesTmdbId == null && !episode.seriesImdbId)
            return [];
        const raw = await this.fetchWithRetry(episode);
        if (!raw)
            return [];
        return mapTheIntroDbResponse(raw, episode.episodeId);
    }
    async fetchWithRetry(episode, attempt = 0) {
        const params = new URLSearchParams();
        if (episode.seriesTmdbId != null) {
            params.set('tmdb_id', String(episode.seriesTmdbId));
        }
        else {
            params.set('imdb_id', episode.seriesImdbId);
        }
        params.set('season', String(episode.seasonNumber));
        params.set('episode', String(episode.episodeNumber));
        const url = `${this.baseUrl}/media?${params}`;
        let response;
        try {
            response = await globalThis.fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'TimeoutError') {
                throw new TheIntroDbNetworkError('TheIntroDB request timed out');
            }
            throw new TheIntroDbNetworkError(`Could not reach TheIntroDB: ${err.message}`);
        }
        this.checkRateLimitHeaders(response);
        if (response.status === 404)
            return null;
        if (response.status === 429) {
            if (attempt >= MAX_RETRIES - 1) {
                const resetSec = Number(response.headers.get('X-RateLimit-Reset') ?? response.headers.get('Retry-After') ?? '60');
                throw new TheIntroDbRateLimitError(resetSec);
            }
            const resetSec = Number(response.headers.get('X-RateLimit-Reset') ?? response.headers.get('Retry-After') ?? '5');
            const backoffMs = Math.min(resetSec * 1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            return this.fetchWithRetry(episode, attempt + 1);
        }
        if (!response.ok) {
            throw new TheIntroDbNetworkError(`TheIntroDB returned HTTP ${response.status}`);
        }
        try {
            return (await response.json());
        }
        catch {
            throw new TheIntroDbNetworkError('Could not parse TheIntroDB response');
        }
    }
    checkRateLimitHeaders(response) {
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining !== null && Number(rateLimitRemaining) < this.rateLimitWarnThreshold) {
            console.warn(JSON.stringify({
                level: 'warn',
                event: 'theintrodb_rate_limit_low',
                remaining: Number(rateLimitRemaining),
                limitType: 'rateLimit',
            }));
        }
        const usageLimitRemaining = response.headers.get('X-UsageLimit-Remaining');
        if (usageLimitRemaining !== null && Number(usageLimitRemaining) < this.rateLimitWarnThreshold) {
            console.warn(JSON.stringify({
                level: 'warn',
                event: 'theintrodb_rate_limit_low',
                remaining: Number(usageLimitRemaining),
                limitType: 'usageLimit',
            }));
        }
    }
}
//# sourceMappingURL=client.js.map