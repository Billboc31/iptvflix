const BASE = import.meta.env.VITE_API_BASE ?? '/api';
const AUTH_TOKEN_KEY = 'iptvflix_auth_token';
export function getStoredAuthToken() {
    try {
        return localStorage.getItem(AUTH_TOKEN_KEY);
    }
    catch {
        return null;
    }
}
export function setStoredAuthToken(token) {
    try {
        localStorage.setItem(AUTH_TOKEN_KEY, token);
    }
    catch {
        // private mode / quota — cookie may still work on desktop
    }
}
export function clearStoredAuthToken() {
    try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
    }
    catch {
        // ignore
    }
}
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
    const token = getStoredAuthToken();
    if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
    }
    const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });
    if (!res.ok) {
        if (res.status === 401)
            clearStoredAuthToken();
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
export function getSimilarMovies(id) {
    return request(`/movies/${id}/similar`);
}
export function listSeries(filters = {}) {
    return request(`/series${toQuery(filters)}`);
}
export function getSeries(id) {
    return request(`/series/${id}`);
}
export function getSimilarSeries(id) {
    return request(`/series/${id}/similar`);
}
export function getSeriesSeasonEpisodes(seriesId, seasonNumber, profileId) {
    return request(`/series/${seriesId}/seasons/${seasonNumber}/episodes${toQuery({ profileId })}`);
}
export function searchContent(q) {
    return request(`/search${toQuery({ q })}`);
}
export function searchDiscover(q) {
    return request(`/search/remote${toQuery({ q })}`);
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
export function dismissContinueWatching(mediaType, mediaId) {
    return request(`/continue-watching/${mediaType}/${mediaId}`, { method: 'DELETE' });
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
export function listProfiles() {
    return request('/profiles');
}
export async function selectProfile(profileId) {
    const res = await request(`/profiles/${profileId}/select`, { method: 'POST' });
    if (res.token)
        setStoredAuthToken(res.token);
    return res;
}
export function createProfile(body) {
    return request('/profiles', { method: 'POST', body: JSON.stringify(body) });
}
export function updateProfile(profileId, body) {
    return request(`/profiles/${profileId}`, { method: 'PATCH', body: JSON.stringify(body) });
}
export function deleteProfile(profileId) {
    return request(`/profiles/${profileId}`, { method: 'DELETE' });
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
export function fetchHomePage(profileId, cursor) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request(`/profiles/${profileId}/home${qs}`);
}
export function fetchSeriesPage(profileId, cursor) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request(`/profiles/${profileId}/series/personalized${qs}`);
}
export function fetchMoviesPage(profileId, cursor) {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    return request(`/profiles/${profileId}/movies${qs}`);
}
export async function login(username, password) {
    const body = { username, password };
    const res = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(body),
    });
    if (res.token)
        setStoredAuthToken(res.token);
    return res;
}
export async function logout() {
    try {
        return await request('/auth/logout', { method: 'POST' });
    }
    finally {
        clearStoredAuthToken();
    }
}
export function getMe() {
    return request('/auth/me');
}
export function fetchArrivals(filter = 'unread') {
    return request(`/arrivals${toQuery({ filter })}`);
}
export function markArrivalRead(id) {
    return request(`/arrivals/${id}/read`, { method: 'PATCH' });
}
export function resolvePlayback(mediaType, mediaId, body = {}) {
    return request(`/playback/resolve/${mediaType}/${mediaId}`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}
export function listDevices() {
    return request('/devices');
}
export function getPairingCodeDetail(code) {
    return request(`/pairing/codes/${code}`);
}
export async function approvePairingCode(code, name) {
    const res = await request(`/pairing/codes/${code}/approve`, { method: 'POST', body: JSON.stringify({ name }) });
    const nested = res?.device;
    if (nested && typeof nested === 'object' && 'id' in nested && 'name' in nested) {
        return nested;
    }
    return res;
}
export function sendPlayOnTvCommand(deviceId, payload) {
    return request(`/devices/${deviceId}/commands`, { method: 'POST', body: JSON.stringify(payload) });
}
export function renameDevice(deviceId, name) {
    return request(`/devices/${deviceId}`, { method: 'PATCH', body: JSON.stringify({ name }) });
}
export function revokeDevice(deviceId) {
    return request(`/devices/${deviceId}`, { method: 'DELETE' });
}
export function semanticQuery(body) {
    return request('/recommendation-lab/semantic-query', { method: 'POST', body: JSON.stringify(body) });
}
export function generateShelfConcepts(body) {
    return request('/shelf-concepts/generate', { method: 'POST', body: JSON.stringify(body) });
}
export function getShelfConceptPool(profileId) {
    return request(`/shelf-concepts${toQuery({ profileId })}`);
}
export function sendShelfConceptFeedback(id, body) {
    return request(`/shelf-concepts/${id}/feedback`, { method: 'POST', body: JSON.stringify(body) });
}
export function previewShelfConcept(id, body) {
    return request(`/shelf-concepts/${id}/preview`, { method: 'POST', body: JSON.stringify(body) });
}
export function recordInteractionEvent(event) {
    return request('/interaction-events', { method: 'POST', body: JSON.stringify(event) });
}
export function batchRecordInteractionEvents(events) {
    return request('/interaction-events/batch', { method: 'POST', body: JSON.stringify({ events }) });
}
//# sourceMappingURL=api.js.map