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
        // private mode / quota
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
// Pick up ?token= query param from VOD→LiveTV redirect
if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const param = url.searchParams.get('token');
    if (param) {
        setStoredAuthToken(param);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
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
export function listProfiles() {
    return request('/profiles');
}
export async function selectProfile(profileId) {
    const res = await request(`/profiles/${profileId}/select`, { method: 'POST' });
    if (res.token)
        setStoredAuthToken(res.token);
    return res;
}
export function listChannels() {
    return request('/channels');
}
//# sourceMappingURL=api.js.map