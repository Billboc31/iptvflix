import { AVATAR_KEYS, FALLBACK_AVATAR_KEY } from '@iptvflix/api-contracts';
export function getAvatarUrl(avatarKey) {
    const key = avatarKey && AVATAR_KEYS.includes(avatarKey)
        ? avatarKey
        : FALLBACK_AVATAR_KEY;
    return `/avatars/${key}.svg`;
}
//# sourceMappingURL=avatars.js.map