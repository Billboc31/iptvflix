import OpenAI from 'openai';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from '../db/schema/index.js';
import type { EmbeddingProvider } from './embedding-provider.js';
import type { SemanticRetrievalService } from './semantic-retrieval-service.js';
import type { ShelfConcept, ShelfConceptProfileContext } from '@iptvflix/api-contracts';
type Db = PostgresJsDatabase<typeof schema>;
export type RawConcept = {
    title: string;
    rawIntent: string;
    semanticIntent: string;
    generationType: string;
    reasonCodes: unknown[];
    desiredMediaTypes: unknown[];
    freshnessPolicy: string | null | undefined;
};
type ValidationResult = {
    valid: true;
} | {
    valid: false;
    reason: string;
};
export declare class ShelfConceptGeneratorService {
    private readonly db;
    private readonly openai;
    private readonly embeddingProvider;
    private readonly semanticRetrieval;
    private readonly model;
    constructor(db: Db, openai: OpenAI | null, embeddingProvider: EmbeddingProvider | null, semanticRetrieval: SemanticRetrievalService | null, model: string);
    buildProfileContext(profileId: string): Promise<ShelfConceptProfileContext>;
    validateConcept(concept: RawConcept, existingConcepts: ShelfConcept[]): ValidationResult;
    generateConcepts(profileId: string, opts?: {
        count?: number;
    }): Promise<ShelfConcept[]>;
    getActivePool(profileId: string): Promise<ShelfConcept[]>;
    needsRefresh(profileId: string): Promise<boolean>;
    applyFeedback(conceptId: string, signal: 'good' | 'bad'): Promise<void>;
    private toApiModel;
}
export {};
//# sourceMappingURL=shelf-concept-generator-service.d.ts.map