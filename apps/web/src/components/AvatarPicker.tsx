import { AVATAR_KEYS } from '@iptvflix/api-contracts'
import { getAvatarUrl } from '../lib/avatars.js'

type Props = {
  value: string | null
  onChange: (avatarKey: string) => void
}

export default function AvatarPicker({ value, onChange }: Props) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-300 mb-3">Choisir un avatar</legend>
      <div className="grid grid-cols-4 gap-3">
        {AVATAR_KEYS.map((key) => {
          const selected = value === key
          return (
            <label
              key={key}
              className={`cursor-pointer rounded-full flex items-center justify-center p-0.5 transition-all ${
                selected ? 'ring-2 ring-[#e50914] ring-offset-2 ring-offset-[#0a0a0f]' : 'hover:opacity-90'
              }`}
            >
              <input
                type="radio"
                name="avatarKey"
                value={key}
                checked={selected}
                onChange={() => onChange(key)}
                className="sr-only"
              />
              <img
                src={getAvatarUrl(key)}
                alt={key}
                width={56}
                height={56}
                className="rounded-full w-14 h-14 object-cover"
                draggable={false}
              />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
