import type { ReleaseEventType, ReleaseLifecycle } from '@iptvflix/api-contracts';
export declare function upsertReleaseFields(mediaType: 'MOVIE' | 'SERIES', mediaId: string, fields: {
    announcedAt?: string | null;
    theatricalReleaseDate?: string | null;
    digitalReleaseDate?: string | null;
}): Promise<void>;
export declare function recordReleaseEvent(mediaType: 'MOVIE' | 'SERIES' | 'EPISODE', mediaId: string, eventType: ReleaseEventType, occurredAt: Date, sourceId?: string | null): Promise<void>;
export declare function getTimeline(mediaType: 'MOVIE' | 'SERIES' | 'EPISODE', mediaId: string): Promise<ReleaseLifecycle>;
//# sourceMappingURL=release-lifecycle-service.d.ts.map