import type { ProgressMediaType, ViewingProgressRow, ContinueWatchingItem } from '@iptvflix/api-contracts';
export declare function upsertProgress(profileId: string, mediaType: ProgressMediaType, mediaId: string, progressSeconds: number, durationSeconds: number): Promise<ViewingProgressRow>;
export declare function listContinueWatching(profileId: string): Promise<ContinueWatchingItem[]>;
//# sourceMappingURL=viewing-progress-service.d.ts.map