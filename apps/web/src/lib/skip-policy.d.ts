import type { EpisodeSegmentItem, ProfilePreferences } from '@iptvflix/api-contracts';
export declare function activeSegment(segments: EpisodeSegmentItem[], positionMs: number): EpisodeSegmentItem | undefined;
export declare function shouldAutoSkip(segment: EpisodeSegmentItem, prefs: Partial<ProfilePreferences>): boolean;
/** Only jump to the next episode when the entire remaining timeline is known to be skippable. */
export declare function coversEnd(segment: EpisodeSegmentItem, segments: EpisodeSegmentItem[], durationMs: number): boolean;
export declare function segmentLabel(type: string): string;
//# sourceMappingURL=skip-policy.d.ts.map