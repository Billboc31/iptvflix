import { moviesDiscoverySnapshots } from '../db/schema/index.js';
export type MoviesSnapshot = typeof moviesDiscoverySnapshots.$inferSelect;
export declare function getMoviesSnapshot(profileId: string): Promise<MoviesSnapshot | null>;
export declare function saveMoviesSnapshot(profileId: string, declaredShelfInstanceIds: string[], expiresAt: Date): Promise<void>;
export declare function invalidateMoviesSnapshot(profileId: string): Promise<void>;
export declare function isMoviesSnapshotValid(snapshot: MoviesSnapshot): boolean;
export declare function isMoviesSnapshotStale(snapshot: MoviesSnapshot): boolean;
//# sourceMappingURL=movies-snapshot-service.d.ts.map