export declare function buildXtreamMovieUrl(baseUrl: string, username: string, password: string, providerItemId: string, containerExtension?: string | null): string;
export declare function buildXtreamEpisodeUrl(baseUrl: string, username: string, password: string, providerItemId: string, containerExtension?: string | null): string;
/** HTTPS so a HTTPS web app can play without mixed-content blocking. */
export declare function browserSafeXtreamUrl(url: string): string;
/** Browser-like UA: some Cloudflare IPTV panels block VLC/Node from datacenter IPs. */
export declare const XTREAM_STREAM_HEADERS: Record<string, string>;
/**
 * Alternate Xtream VOD/live URL shapes for the same credentials.
 * Do not log the returned URLs — they embed username/password.
 */
export declare function xtreamUrlFallbacks(url: string): string[];
/** Fetch via IPv4 + Host header so Cloudflare/Railway IPv6 egress does not block streams. */
export declare function resolveXtreamFetchTarget(url: string): Promise<{
    href: string;
    extraHeaders: Record<string, string>;
}>;
export declare function fetchXtreamStream(url: string, headers: Record<string, string>, signal: AbortSignal): Promise<Response>;
/** Probe candidate URLs with a tiny Range request. Never log the URL (credentials). */
export declare function pickWorkingXtreamUrl(url: string, signal?: AbortSignal): Promise<string>;
export declare function ffmpegInputArgs(providerUrl: string): Promise<string[]>;
//# sourceMappingURL=playback.d.ts.map