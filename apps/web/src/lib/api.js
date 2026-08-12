const BASE = import.meta.env.VITE_API_BASE ?? '/api';
export class ApiError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'ApiError';
    }
}
async function request(path, init) {
    const headers = new Headers(init?.headers);
    // Fastify rejects empty bodies when Content-Type is application/json
    // (e.g. POST /sources/:id/test with no payload).
    if (init?.body != null && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers });
    if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        let message = text;
        try {
            const parsed = JSON.parse(text);
            if (parsed?.error)
                message = parsed.error;
        }
        catch {
            // keep raw text
        }
        throw new ApiError(res.status, message);
    }
    if (res.status === 204)
        return undefined;
    return res.json();
}
function toQuery(params) {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined)
            q.set(k, String(v));
    }
    const s = q.toString();
    return s ? `?${s}` : '';
}
export function listMovies(filters = {}) {
    return request(`/movies${toQuery(filters)}`);
}
export function getMovie(id) {
    return request(`/movies/${id}`);
}
export function listSeries(filters = {}) {
    return request(`/series${toQuery(filters)}`);
}
export function getSeries(id) {
    return request(`/series/${id}`);
}
export function getSeriesSeasonEpisodes(seriesId, seasonNumber, profileId) {
    return request(`/series/${seriesId}/seasons/${seasonNumber}/episodes${toQuery({ profileId })}`);
}
export function searchContent(q) {
    return request(`/search${toQuery({ q })}`);
}
export function materializeMovie(tmdbId) {
    return request('/discovery/movies', { method: 'POST', body: JSON.stringify({ tmdbId }) });
}
export function materializeSeries(tmdbId) {
    return request('/discovery/series', { method: 'POST', body: JSON.stringify({ tmdbId }) });
}
export function listGenres() {
    return request('/genres');
}
export function listSources() {
    return request('/sources');
}
export function createSource(body) {
    return request('/sources', { method: 'POST', body: JSON.stringify(body) });
}
export function updateSource(id, body) {
    return request(`/sources/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteSource(id) {
    return request(`/sources/${id}`, { method: 'DELETE' });
}
export function testSource(id) {
    return request(`/sources/${id}/test`, { method: 'POST' });
}
export function listSyncRuns() {
    return request('/sync-runs');
}
export function triggerSync(body) {
    return request('/sync-runs', { method: 'POST', body: JSON.stringify(body) });
}
export function fetchWatchlist() {
    return request('/watchlist');
}
export function addToWatchlist(body) {
    return request('/watchlist', { method: 'POST', body: JSON.stringify(body) });
}
export function removeFromWatchlist(mediaType, mediaId) {
    return request(`/watchlist/${mediaType}/${mediaId}`, { method: 'DELETE' });
}
export function upsertProgress(mediaType, mediaId, body) {
    return request(`/progress/${mediaType}/${mediaId}`, { method: 'PUT', body: JSON.stringify(body) });
}
export function fetchContinueWatching() {
    return request('/continue-watching');
}
export function fetchShelves() {
    return request('/shelves');
}
export function fetchShelf(id) {
    return request(`/shelves/${id}`);
}
export function createShelf(body) {
    return request('/shelves', { method: 'POST', body: JSON.stringify(body) });
}
export function updateShelf(id, body) {
    return request(`/shelves/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteShelf(id) {
    return request(`/shelves/${id}`, { method: 'DELETE' });
}
export function addShelfMember(id, body) {
    return request(`/shelves/${id}/members`, { method: 'POST', body: JSON.stringify(body) });
}
export function removeShelfMember(id, mediaType, mediaId) {
    return request(`/shelves/${id}/members/${mediaType}/${mediaId}`, { method: 'DELETE' });
}
export function reorderShelfMembers(id, body) {
    return request(`/shelves/${id}/members/order`, { method: 'PUT', body: JSON.stringify(body) });
}
export function generateShelf(body) {
    return request('/shelves/generate', { method: 'POST', body: JSON.stringify(body) });
}
export function refreshShelf(id) {
    return request(`/shelves/${id}/refresh`, { method: 'POST' });
}
export function getProfile() {
    return request('/profile');
}
export function updateProfilePreferences(body) {
    return request('/profile/preferences', { method: 'PATCH', body: JSON.stringify(body) });
}
export function fetchFeedback() {
    return request('/feedback');
}
export function setFeedback(mediaType, mediaId, body) {
    return request(`/feedback/${mediaType}/${mediaId}`, { method: 'PUT', body: JSON.stringify(body) });
}
export function clearFeedback(mediaType, mediaId) {
    return request(`/feedback/${mediaType}/${mediaId}`, { method: 'DELETE' });
}
export function fetchHome(profileId) {
    return request(`/profiles/${profileId}/home`);
}
//# sourceMappingURL=api.js.map