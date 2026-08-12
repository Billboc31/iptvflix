import { XtreamAuthError, XtreamNetworkError, XtreamParseError } from './errors.js';
function sanitizeUrl(url) {
    try {
        const u = new URL(url);
        if (u.searchParams.has('username'))
            u.searchParams.set('username', '[REDACTED]');
        if (u.searchParams.has('password'))
            u.searchParams.set('password', '[REDACTED]');
        return u.toString();
    }
    catch {
        return '[URL_REDACTED]';
    }
}
function parseArrayOrThrow(raw, endpoint) {
    if (!Array.isArray(raw))
        throw new XtreamParseError(endpoint);
    return raw;
}
function parseAccountInfoOrThrow(raw, endpoint) {
    if (typeof raw !== 'object' ||
        raw === null ||
        !('user_info' in raw) ||
        typeof raw.user_info !== 'object' ||
        raw.user_info === null) {
        throw new XtreamParseError(endpoint);
    }
    const userInfo = raw.user_info;
    if (typeof userInfo.status !== 'string')
        throw new XtreamParseError(endpoint);
    return raw;
}
function parseSeriesInfoOrThrow(raw, endpoint) {
    if (typeof raw !== 'object' ||
        raw === null ||
        !('info' in raw) ||
        !('episodes' in raw)) {
        throw new XtreamParseError(endpoint);
    }
    return raw;
}
export class XtreamCodesClient {
    config;
    constructor(config) {
        this.config = { timeoutMs: 10_000, ...config };
    }
    buildUrl(action, params = {}) {
        const url = new URL(`${this.config.baseUrl}/player_api.php`);
        url.searchParams.set('username', this.config.username);
        url.searchParams.set('password', this.config.password);
        url.searchParams.set('action', action);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
        return url.toString();
    }
    async fetch(action, params = {}) {
        const url = this.buildUrl(action, params);
        let response;
        try {
            response = await globalThis.fetch(url, {
                signal: AbortSignal.timeout(this.config.timeoutMs),
            });
        }
        catch (err) {
            if (err instanceof DOMException && err.name === 'TimeoutError') {
                throw new XtreamNetworkError(`Request to ${sanitizeUrl(url)} timed out`);
            }
            throw new XtreamNetworkError(`Could not reach host at ${sanitizeUrl(url)}`);
        }
        if (!response.ok) {
            throw new XtreamAuthError(`Provider rejected request with HTTP ${response.status}`);
        }
        try {
            return await response.json();
        }
        catch {
            throw new XtreamParseError(action);
        }
    }
    async authenticate() {
        const raw = await this.fetch('get_account_info');
        const parsed = parseAccountInfoOrThrow(raw, 'get_account_info');
        if (parsed.user_info.status === 'Disabled') {
            throw new XtreamAuthError('Account is disabled');
        }
        return parsed.user_info;
    }
    async getVodCategories() {
        const raw = await this.fetch('get_vod_categories');
        return parseArrayOrThrow(raw, 'get_vod_categories');
    }
    async getVodStreams(categoryId) {
        const params = {};
        if (categoryId)
            params.category_id = categoryId;
        const raw = await this.fetch('get_vod_streams', params);
        return parseArrayOrThrow(raw, 'get_vod_streams');
    }
    async getSeriesCategories() {
        const raw = await this.fetch('get_series_categories');
        return parseArrayOrThrow(raw, 'get_series_categories');
    }
    async getSeries(categoryId) {
        const params = {};
        if (categoryId)
            params.category_id = categoryId;
        const raw = await this.fetch('get_series', params);
        return parseArrayOrThrow(raw, 'get_series');
    }
    async getSeriesInfo(seriesId) {
        const raw = await this.fetch('get_series_info', { series_id: String(seriesId) });
        return parseSeriesInfoOrThrow(raw, 'get_series_info');
    }
}
//# sourceMappingURL=client.js.map