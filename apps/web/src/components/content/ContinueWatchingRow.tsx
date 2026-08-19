import { useContinueWatching } from '../../hooks/useContinueWatching.js'
import HorizontalRow from './HorizontalRow.js'
import ContinueWatchingCard from './ContinueWatchingCard.js'

export default function ContinueWatchingRow() {
  const { items, loading, dismissItem, dismissError, dismissErrorFor } = useContinueWatching()

  if (loading || items.length === 0) return null

  return (
    <div className="mt-8">
      <HorizontalRow title="Continuer à regarder">
        {items.map((item) => (
          <div
            key={item.id}
            className="relative flex-shrink-0 w-28 md:w-32 lg:w-36 snap-start"
          >
            <ContinueWatchingCard
              item={item}
              onDismiss={dismissItem}
              dismissError={item.mediaId === dismissErrorFor ? dismissError : null}
            />
          </div>
        ))}
      </HorizontalRow>
    </div>
  )
}
