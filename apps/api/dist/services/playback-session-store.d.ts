import type { DeliveryMode } from './playback-compat.js';
export type SessionEntry = {
    sessionId: string;
    profileId: string;
    mediaType: 'movie' | 'episode';
    mediaId: string;
    availabilityId: string;
    sourceId: string;
    providerStreamUrl: string;
    containerExtension: string;
    deliveryMode: DeliveryMode;
    correlationId: string;
};
export declare function createSession(data: Omit<SessionEntry, 'sessionId'>): string;
export declare function getSession(sessionId: string): SessionEntry | null;
export declare function patchSession(sessionId: string, patch: Partial<Pick<SessionEntry, 'deliveryMode' | 'providerStreamUrl'>>): void;
export declare function findSessionByAvailabilityId(availabilityId: string): SessionEntry | null;
//# sourceMappingURL=playback-session-store.d.ts.map