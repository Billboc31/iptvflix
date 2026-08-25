import type { PlaybackSessionResponse } from '@iptvflix/api-contracts';
export type PlaybackMediaType = 'movie' | 'episode';
export declare function resolvePlayback(profileId: string, mediaType: PlaybackMediaType, mediaId: string, explicitAvailabilityId?: string, correlationId?: string, opts?: {
    restart?: boolean;
    clientType?: 'web' | 'android-tv';
}): Promise<PlaybackSessionResponse>;
//# sourceMappingURL=playback-resolver.d.ts.map