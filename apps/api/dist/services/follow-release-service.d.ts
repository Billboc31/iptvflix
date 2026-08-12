import type { FollowReleaseEntry } from '@iptvflix/api-contracts';
type MediaType = 'MOVIE' | 'SERIES';
export declare function follow(profileId: string, mediaType: MediaType, mediaId: string): Promise<FollowReleaseEntry>;
export declare function unfollow(profileId: string, mediaType: MediaType, mediaId: string): Promise<void>;
export declare function listFollowed(profileId: string): Promise<FollowReleaseEntry[]>;
export declare function isFollowing(profileId: string, mediaType: MediaType, mediaId: string): Promise<boolean>;
export {};
//# sourceMappingURL=follow-release-service.d.ts.map