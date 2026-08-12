import type { ProfilePreferences } from '@iptvflix/api-contracts';
export declare const DEFAULT_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
export declare function getDefaultProfile(): Promise<{
    id: string;
    name: string;
    createdAt: Date;
    preferredAudioLanguages: string[];
    preferredSubtitleLanguages: string[];
    preferredSourceIds: string[];
    maxVideoQuality: string | null;
}>;
export declare function getDefaultProfilePreferences(): Promise<ProfilePreferences>;
export declare function updateDefaultProfilePreferences(patch: Partial<ProfilePreferences>): Promise<ProfilePreferences>;
//# sourceMappingURL=profile-service.d.ts.map