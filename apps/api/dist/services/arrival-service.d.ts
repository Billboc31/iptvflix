import type { ArrivalItem } from '@iptvflix/api-contracts';
export declare function recordArrivalsForFollowers(mediaType: 'MOVIE' | 'SERIES', mediaId: string, sourceId: string | null, releaseEventId: string, arrivedAt: Date): Promise<void>;
export declare function listArrivals(profileId: string, filter?: 'unread' | 'all'): Promise<ArrivalItem[]>;
export declare function markRead(profileId: string, arrivalId: string): Promise<void>;
//# sourceMappingURL=arrival-service.d.ts.map