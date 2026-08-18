import { getAvatarUrl } from '../lib/avatars.js'

type Props = {
  avatarKey: string | null | undefined
  name: string
  size?: number
  isActive?: boolean
  isKids?: boolean
  className?: string
}

export default function ProfileAvatar({ avatarKey, name, size = 48, isActive = false, isKids = false, className = '' }: Props) {
  const url = getAvatarUrl(avatarKey)
  const ring = isActive ? 'ring-2 ring-[#e50914] ring-offset-2 ring-offset-[#0a0a0f]' : ''

  return (
    <div className={`relative inline-flex shrink-0 ${className}`} style={{ width: size, height: size }}>
      <img
        src={url}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover w-full h-full ${ring}`}
        draggable={false}
      />
      {isKids && (
        <span
          aria-label="Profil enfant"
          className="absolute bottom-0 right-0 bg-blue-500 text-white text-[8px] font-bold rounded-full px-1 leading-4"
          style={{ fontSize: Math.max(8, size * 0.18) }}
        >
          Kids
        </span>
      )}
    </div>
  )
}
