import { isNotNull } from 'drizzle-orm'

/**
 * Embedding eligibility policy.
 *
 * Required: title must be non-null (enforced by DB NOT NULL constraint).
 * A title is eligible for embedding once it has been enriched (metadataEnrichedAt set).
 * Preferred fields that improve embedding quality: synopsis, genres, originalLanguage.
 * Incomplete titles (no synopsis/genres) are still embedded but with reduced document coverage.
 */
export function isEmbeddingEligible(media: {
  title: string
  metadataEnrichedAt: Date | null
}): boolean {
  return media.metadataEnrichedAt !== null
}

// Raw SQL predicate for use inside sql`` FILTER (WHERE ...) aggregate expressions.
// Must remain in sync with isEmbeddingEligible() above.
export const EMBEDDING_ELIGIBLE_SQL_PREDICATE = 'metadata_enriched_at is not null'

// Drizzle .where() condition builder. Must remain in sync with isEmbeddingEligible() above.
// Cannot be used inside raw sql`` FILTER clauses — use EMBEDDING_ELIGIBLE_SQL_PREDICATE there.
export const embeddingEligibleCondition = (col: Parameters<typeof isNotNull>[0]) => isNotNull(col)
