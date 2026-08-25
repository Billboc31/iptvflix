/**
 * Turn a playback gateway path into an absolute URL for the browser/player.
 * API historically returned `/api/playback/...` for reverse-proxied setups; with
 * `VITE_API_BASE` pointing at the API origin, that `/api` prefix must be stripped.
 */
export function resolveMediaUrl(path, apiBase = import.meta.env.VITE_API_BASE ?? '') {
    if (/^https?:\/\//i.test(path))
        return path;
    const base = String(apiBase ?? '').replace(/\/$/, '');
    let p = path.startsWith('/') ? path : `/${path}`;
    if (base) {
        if (p.startsWith('/api/'))
            p = p.slice(4);
        return `${base}${p}`;
    }
    return p;
}
//# sourceMappingURL=media-url.js.map