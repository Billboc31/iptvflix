import type { EpisodeSegmentItem, ProfilePreferences } from '@iptvflix/api-contracts';
export declare function useEpisodeSegments(episodeId: string | null, durationSeconds: number | null, sourceKey: string | null, mediaType?: 'movie' | 'episode'): EpisodeSegmentItem[];
export declare function usePlaybackPreferences(episodeId: string | null): {
    preferences: Partial<ProfilePreferences>;
    toggleNeverStop: () => Promise<void>;
    saving: boolean;
    preferenceError: string | null;
};
//# sourceMappingURL=useEpisodeSegments.d.ts.map