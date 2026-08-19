/**
 * Turn a TMDB path (`/abc.jpg`) or already-absolute URL into a usable image URL.
 * Provider covers that are full http(s) URLs are returned unchanged.
 */
export declare function resolveMediaImageUrl(path: string | null | undefined, size?: 'w185' | 'w342' | 'w500' | 'w780' | 'original'): string | null;
//# sourceMappingURL=tmdb-image.d.ts.map