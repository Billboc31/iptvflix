export const AVATAR_KEYS = [
  'avatar_01',
  'avatar_02',
  'avatar_03',
  'avatar_04',
  'avatar_05',
  'avatar_06',
  'avatar_07',
  'avatar_08',
] as const

export type AvatarKey = (typeof AVATAR_KEYS)[number]

export const FALLBACK_AVATAR_KEY = 'avatar_01'
