import type { ProfilePreferences, UpdateProfileBody } from '@iptvflix/api-contracts';
export declare function getProfile(profileId: string): Promise<any>;
export declare function getProfilePreferences(profileId: string): Promise<ProfilePreferences>;
export declare function updateProfilePreferences(profileId: string, patch: Partial<ProfilePreferences>): Promise<ProfilePreferences>;
export declare function listProfiles(accountId: string): Promise<any>;
export declare function createProfile(accountId: string, data: {
    name: string;
    avatarKey?: string;
    isKids?: boolean;
    maturityLevel?: string;
}): Promise<any>;
export declare function updateProfile(accountId: string, profileId: string, patch: Partial<UpdateProfileBody>): Promise<any>;
export declare function deleteProfile(accountId: string, profileId: string, currentProfileId?: string): Promise<void>;
export declare function selectProfile(accountId: string, profileId: string): Promise<any>;
export declare function getCurrentProfile(accountId: string, profileId: string): Promise<any>;
export declare const DEFAULT_PROFILE_ID = "00000000-0000-0000-0000-000000000001";
export declare function getDefaultProfilePreferences(): Promise<ProfilePreferences>;
export declare function getDefaultProfile(): Promise<any>;
export declare function updateDefaultProfilePreferences(patch: Partial<ProfilePreferences>): Promise<ProfilePreferences>;
//# sourceMappingURL=profile-service.d.ts.map