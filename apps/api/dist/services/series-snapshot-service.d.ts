import { seriesDiscoverySnapshots } from '../db/schema/index.js';
export type SeriesSnapshot = typeof seriesDiscoverySnapshots.$inferSelect;
export declare function getSeriesSnapshot(profileId: string): Promise<SeriesSnapshot | null>;
export declare function saveSeriesSnapshot(profileId: string, sessionId: string, declaredShelfInstanceIds: string[], expiresAt: Date): Promise<void>;
export declare function invalidateSeriesSnapshot(profileId: string): Promise<void>;
export declare function isSeriesSnapshotValid(snapshot: SeriesSnapshot): boolean;
export declare function isSeriesSnapshotStale(snapshot: SeriesSnapshot): boolean;
//# sourceMappingURL=series-snapshot-service.d.ts.map