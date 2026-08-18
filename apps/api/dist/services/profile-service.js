import { eq, and, count } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profiles, accounts } from '../db/schema/index.js';
export async function getProfile(profileId) {
    const [row] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    if (!row)
        throw new Error('Profile not found');
    return row;
}
export async function getProfilePreferences(profileId) {
    const profile = await getProfile(profileId);
    return {
        preferredAudioLanguages: profile.preferredAudioLanguages ?? [],
        preferredSubtitleLanguages: profile.preferredSubtitleLanguages ?? [],
        preferredSourceIds: profile.preferredSourceIds ?? [],
        maxVideoQuality: profile.maxVideoQuality ?? null,
        autoplayPreviews: profile.autoplayPreviews ?? true,
        autoplayNextEpisode: profile.autoplayNextEpisode ?? true,
        autoSkipIntro: profile.autoSkipIntro ?? false,
        autoSkipRecap: profile.autoSkipRecap ?? false,
        neverStopMode: profile.neverStopMode ?? false,
        subtitlesEnabledPreference: profile.subtitlesEnabledPreference ?? null,
        preferredUiLanguage: profile.preferredUiLanguage ?? null,
    };
}
export async function updateProfilePreferences(profileId, patch) {
    const current = await getProfile(profileId);
    const updated = {
        preferredAudioLanguages: patch.preferredAudioLanguages ?? current.preferredAudioLanguages ?? [],
        preferredSubtitleLanguages: patch.preferredSubtitleLanguages ?? current.preferredSubtitleLanguages ?? [],
        preferredSourceIds: patch.preferredSourceIds ?? current.preferredSourceIds ?? [],
        maxVideoQuality: 'maxVideoQuality' in patch ? (patch.maxVideoQuality ?? null) : (current.maxVideoQuality ?? null),
        autoplayPreviews: 'autoplayPreviews' in patch
            ? (patch.autoplayPreviews ?? true)
            : (current.autoplayPreviews ?? true),
        autoplayNextEpisode: 'autoplayNextEpisode' in patch
            ? (patch.autoplayNextEpisode ?? true)
            : (current.autoplayNextEpisode ?? true),
        autoSkipIntro: 'autoSkipIntro' in patch ? (patch.autoSkipIntro ?? false) : (current.autoSkipIntro ?? false),
        autoSkipRecap: 'autoSkipRecap' in patch ? (patch.autoSkipRecap ?? false) : (current.autoSkipRecap ?? false),
        neverStopMode: 'neverStopMode' in patch ? (patch.neverStopMode ?? false) : (current.neverStopMode ?? false),
        subtitlesEnabledPreference: 'subtitlesEnabledPreference' in patch
            ? (patch.subtitlesEnabledPreference ?? null)
            : (current.subtitlesEnabledPreference ?? null),
        preferredUiLanguage: 'preferredUiLanguage' in patch
            ? (patch.preferredUiLanguage ?? null)
            : (current.preferredUiLanguage ?? null),
    };
    await db
        .update(profiles)
        .set({
        preferredAudioLanguages: updated.preferredAudioLanguages,
        preferredSubtitleLanguages: updated.preferredSubtitleLanguages,
        preferredSourceIds: updated.preferredSourceIds,
        maxVideoQuality: updated.maxVideoQuality,
        autoplayPreviews: updated.autoplayPreviews,
        autoplayNextEpisode: updated.autoplayNextEpisode,
        autoSkipIntro: updated.autoSkipIntro,
        autoSkipRecap: updated.autoSkipRecap,
        neverStopMode: updated.neverStopMode,
        subtitlesEnabledPreference: updated.subtitlesEnabledPreference,
        preferredUiLanguage: updated.preferredUiLanguage,
        updatedAt: new Date(),
    })
        .where(eq(profiles.id, profileId));
    return updated;
}
export async function listProfiles(accountId) {
    return db.select().from(profiles).where(eq(profiles.accountId, accountId));
}
export async function createProfile(accountId, data) {
    const [account] = await db
        .select({ maxProfiles: accounts.maxProfiles })
        .from(accounts)
        .where(eq(accounts.id, accountId));
    if (!account)
        throw new Error('Account not found');
    const [{ profileCount }] = await db
        .select({ profileCount: count() })
        .from(profiles)
        .where(eq(profiles.accountId, accountId));
    if (profileCount >= account.maxProfiles) {
        const err = new Error(`Profile limit reached (max ${account.maxProfiles})`);
        err.code = 'PROFILE_LIMIT_REACHED';
        throw err;
    }
    const [profile] = await db
        .insert(profiles)
        .values({
        accountId,
        name: data.name,
        avatarKey: data.avatarKey,
        isKids: data.isKids ?? false,
        maturityLevel: data.maturityLevel,
    })
        .returning();
    return profile;
}
export async function updateProfile(accountId, profileId, patch) {
    const [existing] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)));
    if (!existing)
        throw new Error('Profile not found');
    const [updated] = await db
        .update(profiles)
        .set({
        ...(patch.name !== undefined && { name: patch.name }),
        ...(patch.avatarKey !== undefined && { avatarKey: patch.avatarKey }),
        ...(patch.isKids !== undefined && { isKids: patch.isKids }),
        ...(patch.maturityLevel !== undefined && { maturityLevel: patch.maturityLevel }),
        ...(patch.preferredUiLanguage !== undefined && {
            preferredUiLanguage: patch.preferredUiLanguage,
        }),
        ...(patch.preferredAudioLanguages !== undefined && {
            preferredAudioLanguages: patch.preferredAudioLanguages,
        }),
        ...(patch.preferredSubtitleLanguages !== undefined && {
            preferredSubtitleLanguages: patch.preferredSubtitleLanguages,
        }),
        ...(patch.preferredSourceIds !== undefined && { preferredSourceIds: patch.preferredSourceIds }),
        ...(patch.maxVideoQuality !== undefined && { maxVideoQuality: patch.maxVideoQuality }),
        ...(patch.subtitlesEnabledPreference !== undefined && {
            subtitlesEnabledPreference: patch.subtitlesEnabledPreference,
        }),
        ...(patch.autoplayPreviews !== undefined && { autoplayPreviews: patch.autoplayPreviews }),
        ...(patch.autoplayNextEpisode !== undefined && {
            autoplayNextEpisode: patch.autoplayNextEpisode,
        }),
        ...(patch.autoSkipIntro !== undefined && { autoSkipIntro: patch.autoSkipIntro }),
        ...(patch.autoSkipRecap !== undefined && { autoSkipRecap: patch.autoSkipRecap }),
        ...(patch.neverStopMode !== undefined && { neverStopMode: patch.neverStopMode }),
        updatedAt: new Date(),
    })
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
        .returning();
    return updated;
}
export async function deleteProfile(accountId, profileId, currentProfileId) {
    const accountProfiles = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(eq(profiles.accountId, accountId));
    if (accountProfiles.length <= 1) {
        const err = new Error('Cannot delete the last profile on an account');
        err.code = 'LAST_PROFILE';
        throw err;
    }
    if (currentProfileId && profileId === currentProfileId) {
        const err = new Error('Cannot delete the currently active profile');
        err.code = 'CURRENT_PROFILE';
        throw err;
    }
    const [existing] = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)));
    if (!existing)
        throw new Error('Profile not found');
    await db.delete(profiles).where(eq(profiles.id, profileId));
}
export async function selectProfile(accountId, profileId) {
    const [profile] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)));
    if (!profile) {
        const err = new Error('Profile not found or does not belong to this account');
        err.code = 'PROFILE_NOT_FOUND';
        throw err;
    }
    await db
        .update(profiles)
        .set({ lastUsedAt: new Date() })
        .where(eq(profiles.id, profileId));
    return profile;
}
export async function getCurrentProfile(accountId, profileId) {
    const [profile] = await db
        .select()
        .from(profiles)
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)));
    if (!profile)
        throw new Error('Profile not found');
    return profile;
}
// Backward-compat alias used by catalog routes and playback-resolver for the
// pre-T098 single-profile setup where no session profile is available.
export const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001';
export async function getDefaultProfilePreferences() {
    return getProfilePreferences(DEFAULT_PROFILE_ID);
}
export async function getDefaultProfile() {
    return getProfile(DEFAULT_PROFILE_ID);
}
export async function updateDefaultProfilePreferences(patch) {
    return updateProfilePreferences(DEFAULT_PROFILE_ID, patch);
}
//# sourceMappingURL=profile-service.js.map