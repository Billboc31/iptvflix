export interface VariantAttributes {
    audioLanguage: 'fr' | 'en' | null;
    subtitleLanguage: 'fr' | null;
    videoQuality: '4K' | '1080p' | '720p' | '480p' | null;
    codecName: string | null;
    hdrFormat: string | null;
    releaseHint: string | null;
    audioFormat: string | null;
}
export declare function extractVariantAttributes(raw: string): VariantAttributes;
//# sourceMappingURL=variant-extractor.d.ts.map