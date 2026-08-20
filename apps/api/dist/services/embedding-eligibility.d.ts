import { isNotNull } from 'drizzle-orm';
/**
 * Embedding eligibility policy.
 *
 * Required: title must be non-null (enforced by DB NOT NULL constraint).
 * A title is eligible for embedding once it has been enriched (metadataEnrichedAt set).
 * Preferred fields that improve embedding quality: synopsis, genres, originalLanguage.
 * Incomplete titles (no synopsis/genres) are still embedded but with reduced document coverage.
 */
export declare function isEmbeddingEligible(media: {
    title: string;
    metadataEnrichedAt: Date | null;
}): boolean;
export declare const EMBEDDING_ELIGIBLE_SQL_PREDICATE = "metadata_enriched_at is not null";
export declare const embeddingEligibleCondition: (col: Parameters<typeof isNotNull>[0]) => import("drizzle-orm").SQL<unknown>;
//# sourceMappingURL=embedding-eligibility.d.ts.map