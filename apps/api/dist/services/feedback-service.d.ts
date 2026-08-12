import type { WatchlistMediaType, FeedbackType, FeedbackItem } from '@iptvflix/api-contracts';
export declare function upsertFeedback(profileId: string, mediaType: WatchlistMediaType, mediaId: string, feedback: FeedbackType): Promise<FeedbackItem>;
export declare function removeFeedback(profileId: string, mediaType: WatchlistMediaType, mediaId: string): Promise<void>;
export declare function listFeedback(profileId: string): Promise<FeedbackItem[]>;
//# sourceMappingURL=feedback-service.d.ts.map