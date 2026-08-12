import { type VariantAttributes } from './variant-extractor.js';
export type { VariantAttributes } from './variant-extractor.js';
export interface NormalizeResult {
    normalizedTitle: string;
    extractedYear: number | null;
    variantAttributes: VariantAttributes;
}
export declare function normalizeTitle(raw: string): NormalizeResult;
//# sourceMappingURL=title-normalizer.d.ts.map