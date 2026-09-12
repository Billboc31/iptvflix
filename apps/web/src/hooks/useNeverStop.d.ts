import type { RefObject } from 'react';
import type { EpisodeSegmentItem, ProfilePreferences } from '@iptvflix/api-contracts';
/** Segment times are absolute; remux playback starts on a local timeline. */
export declare function useNeverStop(videoRef: RefObject<HTMLVideoElement | null>, segments: EpisodeSegmentItem[], preferences: Partial<ProfilePreferences>, enabled: boolean, timelineOffsetSeconds: number, mediaKey: string, onNext: () => boolean, totalDurationSeconds?: number | null): {
    active: EpisodeSegmentItem | undefined;
    skip: (segment: EpisodeSegmentItem) => boolean;
};
//# sourceMappingURL=useNeverStop.d.ts.map