import { PlexAuthError, PlexNetworkError, PlexParseError } from './errors.js';
const DEFAULT_TIMEOUT_MS = 10_000;
export class PlexClient {
    baseUrl;
    token;
    timeoutMs;
    constructor(baseUrl, token, timeoutMs) {
        this.baseUrl = baseUrl;
        this.token = token;
        this.timeoutMs = timeoutMs ?? DEFAULT_TIMEOUT_MS;
    }
    async fetch(path, params = {}) {
        const url = new URL(path, this.baseUrl);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        let response;
        try {
            response = await globalThis.fetch(url.toString(), {
                headers: {
                    'X-Plex-Token': this.token,
                    Accept: 'application/json',
                },
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'TimeoutError') {
                throw new PlexNetworkError('Request to Plex server timed out');
            }
            throw new PlexNetworkError('Could not reach Plex server');
        }
        if (response.status === 401 || response.status === 403) {
            throw new PlexAuthError(`Plex rejected request with HTTP ${response.status}`);
        }
        if (!response.ok) {
            throw new PlexNetworkError(`Plex server responded with HTTP ${response.status}`);
        }
        try {
            return await response.json();
        }
        catch {
            throw new PlexParseError(path);
        }
    }
    async testConnection() {
        try {
            const raw = await this.fetch('/identity');
            const container = raw?.MediaContainer;
            if (!container || typeof container !== 'object') {
                return { ok: false, message: 'Unexpected response from Plex server' };
            }
            return {
                ok: true,
                serverName: typeof container.friendlyName === 'string' ? container.friendlyName : undefined,
            };
        }
        catch (err) {
            if (err instanceof PlexAuthError) {
                return { ok: false, message: 'Authentication failed: check your Plex token' };
            }
            if (err instanceof PlexNetworkError) {
                return { ok: false, message: 'Could not reach the Plex server' };
            }
            return { ok: false, message: 'Connection failed' };
        }
    }
    async fetchLibrarySections() {
        const raw = await this.fetch('/library/sections');
        const directories = raw?.MediaContainer;
        const dirs = directories?.Directory;
        if (!Array.isArray(dirs))
            throw new PlexParseError('/library/sections');
        return dirs
            .filter((d) => {
            const entry = d;
            return entry?.type === 'movie' || entry?.type === 'show';
        })
            .map((d) => {
            const entry = d;
            return {
                key: String(entry.key),
                title: String(entry.title),
                type: entry.type,
            };
        });
    }
    async fetchMovies(sectionKey) {
        const raw = await this.fetch(`/library/sections/${sectionKey}/all`, { type: '1' });
        const container = raw?.MediaContainer;
        const metadata = container?.Metadata;
        if (!Array.isArray(metadata))
            return [];
        return metadata.map((m) => mapMetadataItem(m));
    }
    async fetchShows(sectionKey) {
        const raw = await this.fetch(`/library/sections/${sectionKey}/all`, { type: '2' });
        const container = raw?.MediaContainer;
        const metadata = container?.Metadata;
        if (!Array.isArray(metadata))
            return [];
        return metadata.map((m) => mapMetadataItem(m));
    }
    async fetchEpisodes(sectionKey) {
        const raw = await this.fetch(`/library/sections/${sectionKey}/all`, { type: '4' });
        const container = raw?.MediaContainer;
        const metadata = container?.Metadata;
        if (!Array.isArray(metadata))
            return [];
        return metadata.map((m) => mapEpisodeMetadataItem(m));
    }
}
function mapMetadataItem(m) {
    return {
        ratingKey: String(m.ratingKey),
        title: String(m.title),
        year: typeof m.year === 'number' ? m.year : undefined,
        thumb: typeof m.thumb === 'string' ? m.thumb : undefined,
        summary: typeof m.summary === 'string' ? m.summary : undefined,
        Guid: Array.isArray(m.Guid)
            ? m.Guid
                .filter((g) => typeof g === 'object' && g !== null)
                .filter((g) => typeof g.id === 'string')
                .map((g) => ({ id: g.id }))
            : undefined,
    };
}
function mapEpisodeMetadataItem(m) {
    return {
        ratingKey: String(m.ratingKey),
        grandparentRatingKey: String(m.grandparentRatingKey),
        parentIndex: typeof m.parentIndex === 'number' ? m.parentIndex : 0,
        index: typeof m.index === 'number' ? m.index : 0,
        title: String(m.title),
        summary: typeof m.summary === 'string' ? m.summary : undefined,
        duration: typeof m.duration === 'number' ? m.duration : undefined,
        originallyAvailableAt: typeof m.originallyAvailableAt === 'string' ? m.originallyAvailableAt : undefined,
    };
}
//# sourceMappingURL=client.js.map