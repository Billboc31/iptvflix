/**
 * Turn a playback gateway path into an absolute URL for the browser/player.
 * API historically returned `/api/playback/...` for reverse-proxied setups; with
 * `VITE_API_BASE` pointing at the API origin, that `/api` prefix must be stripped.
 */
export declare function resolveMediaUrl(path: string, apiBase?: string): string;
//# sourceMappingURL=media-url.d.ts.map