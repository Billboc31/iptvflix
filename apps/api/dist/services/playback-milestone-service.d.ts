export type PlaybackMilestone = 'WATCHED_10_PERCENT' | 'WATCHED_25_PERCENT' | 'WATCHED_50_PERCENT' | 'WATCHED_75_PERCENT' | 'WATCHED_90_PERCENT';
export declare const MILESTONE_THRESHOLDS: Record<PlaybackMilestone, number>;
export declare const MILESTONE_TYPES: Set<string>;
export declare function milestoneForPercent(percent: number): PlaybackMilestone | null;
export declare function emitMilestoneIfNew(profileId: string, mediaId: string, sessionId: string | null, milestone: PlaybackMilestone, mediaType: string, positionMs?: number): Promise<void>;
//# sourceMappingURL=playback-milestone-service.d.ts.map