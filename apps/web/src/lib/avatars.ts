import { AVATAR_KEYS, FALLBACK_AVATAR_KEY } from '@iptvflix/api-contracts'

export function getAvatarUrl(avatarKey: string | null | undefined): string {
  const key = avatarKey && (AVATAR_KEYS as readonly string[]).includes(avatarKey)
    ? avatarKey
    : FALLBACK_AVATAR_KEY
  return `/avatars/${key}.svg`
}
