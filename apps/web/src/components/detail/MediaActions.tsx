import { useNavigate } from 'react-router-dom'
import type { WatchlistMediaType } from '@iptvflix/api-contracts'
import Button from '../ui/Button.js'
import WatchlistButton from '../content/WatchlistButton.js'
import FeedbackButtons from '../content/FeedbackButtons.js'

type Props = {
  mediaType: WatchlistMediaType
  mediaId: string
  availabilityStatus: 'AVAILABLE' | 'UNAVAILABLE'
  /** Full route to navigate to on play. If absent, no play button is rendered. */
  playRoute?: string | null
  onPlayOnTv?: () => void
  showPlayOnTv?: boolean
}

export default function MediaActions({
  mediaType,
  mediaId,
  availabilityStatus,
  playRoute,
  onPlayOnTv,
  showPlayOnTv,
}: Props) {
  const navigate = useNavigate()
  const isAvailable = availabilityStatus === 'AVAILABLE'

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      <Button variant="ghost" className="min-h-[44px]" onClick={() => navigate(-1)}>
        ← Retour
      </Button>

      {playRoute != null && (
        isAvailable ? (
          <Button
            className="min-h-[44px]"
            onClick={() => navigate(playRoute)}
            aria-label="Lecture"
          >
            ▶ Lecture
          </Button>
        ) : (
          <Button className="min-h-[44px]" disabled aria-label="Non disponible">
            ▶ Non disponible
          </Button>
        )
      )}

      {showPlayOnTv && (
        <Button variant="secondary" className="min-h-[44px]" onClick={onPlayOnTv}>
          📺 Lire sur TV
        </Button>
      )}

      <WatchlistButton mediaType={mediaType} mediaId={mediaId} />
      <FeedbackButtons mediaType={mediaType} mediaId={mediaId} />
    </div>
  )
}
