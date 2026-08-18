export type ProfilePreferences = {
  preferredAudioLanguages: string[]
  preferredSubtitleLanguages: string[]
  preferredSourceIds: string[]
  maxVideoQuality: string | null
  autoplayPreviews: boolean
  autoplayNextEpisode?: boolean
  autoSkipIntro?: boolean
  autoSkipRecap?: boolean
  neverStopMode?: boolean
  subtitlesEnabledPreference?: boolean | null
  preferredUiLanguage?: string | null
}

export type UpdateProfilePreferencesBody = Partial<ProfilePreferences>

export type ProfileResponse = {
  id: string
  accountId: string | null
  name: string
  avatarKey: string | null
  isKids: boolean
  maturityLevel: string | null
  preferredUiLanguage: string | null
  preferredAudioLanguages: string[]
  preferredSubtitleLanguages: string[]
  preferredSourceIds: string[]
  maxVideoQuality: string | null
  subtitlesEnabledPreference: boolean | null
  autoplayPreviews: boolean
  autoplayNextEpisode: boolean
  autoSkipIntro: boolean
  autoSkipRecap: boolean
  neverStopMode: boolean
  createdAt: string
  updatedAt: string
  lastUsedAt: string | null
}

export type CreateProfileBody = {
  name: string
  avatarKey?: string
  isKids?: boolean
  maturityLevel?: string
}

export type UpdateProfileBody = Partial<{
  name: string
  avatarKey: string | null
  isKids: boolean
  maturityLevel: string | null
  preferredUiLanguage: string | null
  preferredAudioLanguages: string[]
  preferredSubtitleLanguages: string[]
  preferredSourceIds: string[]
  maxVideoQuality: string | null
  subtitlesEnabledPreference: boolean | null
  autoplayPreviews: boolean
  autoplayNextEpisode: boolean
  autoSkipIntro: boolean
  autoSkipRecap: boolean
  neverStopMode: boolean
}>

export type SelectProfileResponse = {
  token: string
  profile: ProfileResponse
}
