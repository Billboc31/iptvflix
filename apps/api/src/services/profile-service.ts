import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { profiles } from '../db/schema/index.js'
import type { ProfilePreferences } from '@iptvflix/api-contracts'

export const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

export async function getDefaultProfile() {
  const [row] = await db.select().from(profiles).where(eq(profiles.id, DEFAULT_PROFILE_ID))
  if (!row) throw new Error('Default profile not found — run migrations')
  return row
}

export async function getDefaultProfilePreferences(): Promise<ProfilePreferences> {
  const profile = await getDefaultProfile()
  return {
    preferredAudioLanguages: profile.preferredAudioLanguages ?? [],
    preferredSubtitleLanguages: profile.preferredSubtitleLanguages ?? [],
    preferredSourceIds: profile.preferredSourceIds ?? [],
    maxVideoQuality: profile.maxVideoQuality ?? null,
  }
}

export async function updateDefaultProfilePreferences(
  patch: Partial<ProfilePreferences>,
): Promise<ProfilePreferences> {
  const current = await getDefaultProfile()

  const updated = {
    preferredAudioLanguages:
      patch.preferredAudioLanguages ?? current.preferredAudioLanguages ?? [],
    preferredSubtitleLanguages:
      patch.preferredSubtitleLanguages ?? current.preferredSubtitleLanguages ?? [],
    preferredSourceIds: patch.preferredSourceIds ?? current.preferredSourceIds ?? [],
    maxVideoQuality:
      'maxVideoQuality' in patch ? (patch.maxVideoQuality ?? null) : (current.maxVideoQuality ?? null),
  }

  await db
    .update(profiles)
    .set({
      preferredAudioLanguages: updated.preferredAudioLanguages,
      preferredSubtitleLanguages: updated.preferredSubtitleLanguages,
      preferredSourceIds: updated.preferredSourceIds,
      maxVideoQuality: updated.maxVideoQuality,
    })
    .where(eq(profiles.id, DEFAULT_PROFILE_ID))

  return updated
}
