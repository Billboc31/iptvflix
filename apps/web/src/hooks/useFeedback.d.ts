import type { FeedbackItem, FeedbackType, WatchlistMediaType } from '@iptvflix/api-contracts';
export type UseFeedbackResult = {
    entries: FeedbackItem[];
    loading: boolean;
    set: (mediaType: WatchlistMediaType, mediaId: string, feedback: FeedbackType) => Promise<void>;
    clear: (mediaType: WatchlistMediaType, mediaId: string) => Promise<void>;
    get: (mediaType: WatchlistMediaType, mediaId: string) => FeedbackItem | undefined;
};
export declare function useFeedback(): UseFeedbackResult;
//# sourceMappingURL=useFeedback.d.ts.map