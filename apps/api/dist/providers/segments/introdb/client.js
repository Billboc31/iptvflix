import { IntroDbRateLimitError, IntroDbNetworkError } from './errors.js';
import { mapIntroDbResponse } from './mapper.js';
const DEFAULT_BASE_URL = 'https://api.introdb.net';
const MAX_RETRIES = 3;
const MAX_BACKOFF_MS = 60_000;
export class IntroDbClient {
    baseUrl;
    timeoutMs;
    constructor(config = {}) {
        this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
        this.timeoutMs = config.timeoutMs ?? 10_000;
    }
    async fetchEpisodeSegments(episode) {
        if (!episode.seriesImdbId)
            return [];
        const raw = await this.fetchWithRetry(episode.seriesImdbId, episode.seasonNumber, episode.episodeNumber);
        if (!raw)
            return [];
        return mapIntroDbResponse(raw, episode.episodeId);
    }
    async fetchRaw(imdbId, season, episode) {
        return this.fetchWithRetry(imdbId, season, episode);
    }
    async fetchWithRetry(imdbId, season, episode, attempt = 0) {
        const params = new URLSearchParams({
            imdb_id: imdbId,
            season: String(season),
            episode: String(episode),
        });
        const url = `${this.baseUrl}/segments?${params}`;
        let response;
        try {
            response = await globalThis.fetch(url, { signal: AbortSignal.timeout(this.timeoutMs) });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'TimeoutError') {
                throw new IntroDbNetworkError('IntroDB request timed out');
            }
            throw new IntroDbNetworkError(`Could not reach IntroDB: ${err.message}`);
        }
        if (response.status === 404)
            return null;
        if (response.status === 429) {
            if (attempt >= MAX_RETRIES - 1)
                throw new IntroDbRateLimitError();
            const retryAfterSec = Number(response.headers.get('Retry-After') ?? '5');
            const backoffMs = Math.min(retryAfterSec * 1000 * Math.pow(2, attempt), MAX_BACKOFF_MS);
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            return this.fetchWithRetry(imdbId, season, episode, attempt + 1);
        }
        if (!response.ok) {
            throw new IntroDbNetworkError(`IntroDB returned HTTP ${response.status}`);
        }
        try {
            return (await response.json());
        }
        catch {
            throw new IntroDbNetworkError('Could not parse IntroDB response');
        }
    }
}
//# sourceMappingURL=client.js.map