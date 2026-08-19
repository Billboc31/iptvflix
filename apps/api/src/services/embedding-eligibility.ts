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
