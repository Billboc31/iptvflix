import type { CanonicalEpisodeRef, RawSegment, SegmentProvider } from '../types.js';
export declare class TheIntroDbClient implements SegmentProvider {
    private readonly baseUrl;
    private readonly timeoutMs;
    private readonly rateLimitWarnThreshold;
    constructor(config?: {
        baseUrl?: string;
        timeoutMs?: number;
        rateLimitWarnThreshold?: number;
    });
    fetchEpisodeSegments(episode: CanonicalEpisodeRef): Promise<RawSegment[]>;
    private fetchWithRetry;
    private checkRateLimitHeaders;
}
//# sourceMappingURL=client.d.ts.map