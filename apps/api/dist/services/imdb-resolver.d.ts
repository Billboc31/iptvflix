import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { TmdbClient } from '../providers/metadata/tmdb/client.js';
type Db = PostgresJsDatabase<typeof schema>;
export declare function resolveAndPersistSeriesImdbId(db: Db, tmdbClient: TmdbClient, seriesId: string): Promise<string | null>;
export {};
//# sourceMappingURL=imdb-resolver.d.ts.map