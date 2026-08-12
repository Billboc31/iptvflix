import { useFeedback } from '../../hooks/useFeedback.js'
import type { WatchlistMediaType, FeedbackType } from '@iptvflix/api-contracts'

type FeedbackButtonsProps = {
  mediaType: WatchlistMediaType
  mediaId: string
}

const BUTTONS: { type: FeedbackType; label: string; icon: string }[] = [
  { type: 'LIKE', label: "J'aime", icon: '👍' },
  { type: 'DISLIKE', label: "Je n'aime pas", icon: '👎' },
  { type: 'NOT_INTERESTED', label: 'Pas intéressé', icon: '✕' },
]

export default function FeedbackButtons({ mediaType, mediaId }: FeedbackButtonsProps) {
  const { get, set, clear } = useFeedback()
  const current = get(mediaType, mediaId)

  const handleClick = (type: FeedbackType) => {
    if (current?.feedback === type) {
      clear(mediaType, mediaId)
    } else {
      set(mediaType, mediaId, type)
    }
  }

  return (
    <div className="flex gap-2">
      {BUTTONS.map(({ type, label, icon }) => (
        <button
          key={type}
          onClick={() => handleClick(type)}
          aria-label={label}
          title={label}
          aria-pressed={current?.feedback === type}
          className={`flex items-center gap-2 px-4 py-2 rounded border text-sm font-medium transition-colors ${
            current?.feedback === type
              ? 'bg-white/20 border-white text-white'
              : 'border-white/40 text-white hover:bg-white/10'
          }`}
        >
          <span className="text-lg leading-none">{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
