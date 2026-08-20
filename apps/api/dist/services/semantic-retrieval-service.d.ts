import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { EmbeddingService, SemanticCandidate } from './embedding-service.js';
type Db = PostgresJsDatabase<typeof schema>;
export interface SemanticResult extends SemanticCandidate {
    title: string;
    year: number | null;
    posterPath: string | null;
}
export declare class SemanticRetrievalService {
    private readonly db;
    private readonly embeddingService;
    constructor(db: Db, embeddingService: EmbeddingService);
    retrieve(queryText: string, topK?: number, queryTextOverride?: string): Promise<SemanticResult[]>;
    private enrichWithMetadata;
}
export {};
//# sourceMappingURL=semantic-retrieval-service.d.ts.map