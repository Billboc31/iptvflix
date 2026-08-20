import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import { type MediaType } from './embedding-document-builder.js';
import type { EmbeddingProvider } from './embedding-provider.js';
type Db = PostgresJsDatabase<typeof schema>;
export type UpsertAction = 'embedded' | 'skipped' | 'not-found';
export interface UpsertResult {
    action: UpsertAction;
    mediaId: string;
    mediaType: MediaType;
    docHash?: string;
}
export interface SemanticCandidate {
    mediaId: string;
    mediaType: MediaType;
    similarity: number;
    modelProvider: string;
    modelName: string;
    rank: number;
    docHash: string;
    generatedAt: Date;
}
export declare class EmbeddingService {
    private readonly db;
    private readonly provider;
    constructor(db: Db, provider: EmbeddingProvider);
    upsertEmbedding(mediaId: string, mediaType: MediaType): Promise<UpsertResult>;
    semanticSearch(queryText: string, topK: number): Promise<SemanticCandidate[]>;
    private buildDocumentForMedia;
}
export {};
//# sourceMappingURL=embedding-service.d.ts.map