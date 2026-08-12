import type { ProfilePreferences } from '@iptvflix/api-contracts';
export type ResolvableVariant = {
    id: string;
    status: 'AVAILABLE' | 'UNAVAILABLE';
    providerId: string;
    audioLanguage: string | null;
    subtitleLanguage: string | null;
    videoQuality: string | null;
};
export type ResolveResult = {
    selectedVariantId: string | null;
    alternativeVariantIds: string[];
    reason: string;
};
export declare function isAboveCap(quality: string | null, maxVideoQuality: string | null): boolean;
export declare function resolveVariant(variants: ResolvableVariant[], prefs: ProfilePreferences): ResolveResult;
//# sourceMappingURL=availability-resolver.d.ts.map