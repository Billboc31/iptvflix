import { parseM3U, classifyEntries } from './parser.js';
import { M3UAuthError, M3UNetworkError } from './errors.js';
const REDACTED_PARAMS = new Set(['username', 'password', 'token']);
export function sanitizeUrl(url) {
    try {
        const u = new URL(url);
        // Redact credential-bearing query params
        for (const key of [...u.searchParams.keys()]) {
            if (REDACTED_PARAMS.has(key.toLowerCase())) {
                u.searchParams.set(key, '[REDACTED]');
            }
        }
        // Redact HTTP Basic auth userinfo
        if (u.username || u.password) {
            u.username = '[REDACTED]';
            u.password = '[REDACTED]';
        }
        return u.toString();
    }
    catch {
        return '[URL_REDACTED]';
    }
}
function resolvePlaylistUrl(playlistUrl, username, password) {
    let resolved = playlistUrl;
    if (username !== undefined)
        resolved = resolved.replaceAll('{username}', encodeURIComponent(username));
    if (password !== undefined)
        resolved = resolved.replaceAll('{password}', encodeURIComponent(password));
    return resolved;
}
export class M3UClient {
    resolvedUrl;
    timeoutMs;
    constructor(config) {
        this.resolvedUrl = resolvePlaylistUrl(config.playlistUrl, config.username, config.password);
        this.timeoutMs = config.timeoutMs ?? 60_000;
    }
    async testConnection() {
        try {
            // Attempt a range request for the first 4 KB; fall back to full fetch if not supported
            let response;
            try {
                response = await globalThis.fetch(this.resolvedUrl, {
                    headers: { Range: 'bytes=0-4095' },
                    signal: AbortSignal.timeout(this.timeoutMs),
                });
                // Some servers return 416 for range on playlist — fall back to full fetch
                if (response.status === 416) {
                    response = await globalThis.fetch(this.resolvedUrl, {
                        signal: AbortSignal.timeout(this.timeoutMs),
                    });
                }
            }
            catch (err) {
                if (err instanceof DOMException && err.name === 'TimeoutError') {
                    throw new M3UNetworkError(`Request to ${sanitizeUrl(this.resolvedUrl)} timed out`);
                }
                throw new M3UNetworkError(`Could not reach host at ${sanitizeUrl(this.resolvedUrl)}`);
            }
            if (response.status === 401 || response.status === 403) {
                throw new M3UAuthError(`Provider rejected request with HTTP ${response.status}`);
            }
            if (!response.ok) {
                return { ok: false, message: `Server responded with HTTP ${response.status}` };
            }
            const text = await response.text();
            const trimmed = text.trimStart();
            if (!trimmed.startsWith('#EXTM3U')) {
                return { ok: false, message: 'URL did not return a valid M3U playlist' };
            }
            return { ok: true };
        }
        catch (err) {
            if (err instanceof M3UAuthError) {
                return { ok: false, message: err.message };
            }
            if (err instanceof M3UNetworkError) {
                return { ok: false, message: err.message };
            }
            return { ok: false, message: 'Connection failed' };
        }
    }
    async fetchSnapshot(sourceId) {
        let response;
        try {
            response = await globalThis.fetch(this.resolvedUrl, {
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'TimeoutError') {
                throw new M3UNetworkError(`Request to ${sanitizeUrl(this.resolvedUrl)} timed out`);
            }
            throw new M3UNetworkError(`Could not reach host at ${sanitizeUrl(this.resolvedUrl)}`);
        }
        if (response.status === 401 || response.status === 403) {
            throw new M3UAuthError(`Provider rejected request with HTTP ${response.status}`);
        }
        if (!response.ok) {
            throw new M3UNetworkError(`Server responded with HTTP ${response.status}`);
        }
        const text = await response.text();
        const entries = parseM3U(text);
        const classified = classifyEntries(entries);
        const movies = classified.filter((e) => e.kind === 'movie');
        const episodes = classified.filter((e) => e.kind === 'episode');
        const unclassified = classified.filter((e) => e.kind === 'unclassified');
        return { sourceId, fetchedAt: new Date(), movies, episodes, unclassified };
    }
}
//# sourceMappingURL=client.js.map