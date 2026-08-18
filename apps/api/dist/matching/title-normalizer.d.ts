import { type VariantAttributes } from './variant-extractor.js';
export type { VariantAttributes } from './variant-extractor.js';
export interface NormalizeResult {
    normalizedTitle: string;
    extractedYear: number | null;
    variantAttributes: VariantAttributes;
}
/**
 * Build a human display title from a noisy provider name
 * (e.g. "4K-FR - Dune Part Two 2024 1080p" → "Dune Part Two").
 */
export declare function toCanonicalDisplayTitle(raw: string): string | null;
export declare function normalizeTitle(raw: string): NormalizeResult;
//# sourceMappingURL=title-normalizer.d.ts.map