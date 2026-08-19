import type { IntroDbSegmentResponse } from './types.js';
import type { CanonicalEpisodeRef, RawSegment, SegmentProvider } from '../types.js';
export declare class IntroDbClient implements SegmentProvider {
    private readonly baseUrl;
    private readonly timeoutMs;
    constructor(config?: {
        baseUrl?: string;
        timeoutMs?: number;
    });
    fetchEpisodeSegments(episode: CanonicalEpisodeRef): Promise<RawSegment[]>;
    fetchRaw(imdbId: string, season: number, episode: number): Promise<IntroDbSegmentResponse | null>;
    private fetchWithRetry;
}
//# sourceMappingURL=client.d.ts.map