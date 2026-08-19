export declare function openSession(opts: {
    profileId: string;
    mediaType: string;
    mediaId: string;
    episodeId?: string | null;
    startPositionMs?: number;
    deviceType?: string | null;
    clientType?: string | null;
    sourceId?: string | null;
    availabilityId?: string | null;
}): Promise<string>;
export declare function updateSession(sessionId: string, opts: {
    endPositionMs?: number;
    maxPositionMs?: number;
    watchedMsApprox?: number;
}): Promise<void>;
export declare function closeSession(sessionId: string, completed: boolean): Promise<void>;
export declare function getActiveSession(profileId: string, mediaId: string): Promise<{
    id: string;
} | null>;
//# sourceMappingURL=viewing-session-service.d.ts.map