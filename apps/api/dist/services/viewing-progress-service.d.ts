import type { ProgressMediaType, ViewingProgressRow, ContinueWatchingItem } from '@iptvflix/api-contracts';
export declare const CW_MIN_PROGRESS_SECONDS = 2;
export declare const CW_COMPLETED_RATIO = 0.9;
/** Durations below this are treated as unreliable for "completed" detection. */
export declare const CW_MIN_CREDIBLE_DURATION_SECONDS = 600;
export declare function upsertProgress(profileId: string, mediaType: ProgressMediaType, mediaId: string, progressSeconds: number, durationSeconds: number): Promise<ViewingProgressRow>;
export declare function dismissContinueWatching(profileId: string, mediaType: ProgressMediaType, mediaId: string): Promise<void>;
export declare function listContinueWatching(profileId: string): Promise<ContinueWatchingItem[]>;
//# sourceMappingURL=viewing-progress-service.d.ts.map