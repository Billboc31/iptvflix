import { homeDiscoverySnapshots } from '../db/schema/index.js';
export type Snapshot = typeof homeDiscoverySnapshots.$inferSelect;
export declare function getSnapshot(profileId: string): Promise<Snapshot | null>;
export declare function saveSnapshot(profileId: string, sessionId: string, declaredShelfInstanceIds: string[], expiresAt: Date, heroMediaId: string | null, heroMediaType: string | null): Promise<void>;
export declare function invalidateSnapshot(profileId: string): Promise<void>;
export declare function isSnapshotValid(snapshot: Snapshot): boolean;
export declare function isStale(snapshot: Snapshot): boolean;
//# sourceMappingURL=home-snapshot-service.d.ts.map