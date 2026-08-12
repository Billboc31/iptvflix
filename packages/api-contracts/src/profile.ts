export type ProfilePreferences = {
  preferredAudioLanguages: string[]
  preferredSubtitleLanguages: string[]
  preferredSourceIds: string[]
  maxVideoQuality: string | null
}

export type UpdateProfilePreferencesBody = Partial<ProfilePreferences>

export type ProfileResponse = {
  id: string
  name: string
  preferences: ProfilePreferences
}
