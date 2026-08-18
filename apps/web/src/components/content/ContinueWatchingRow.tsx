import { useContinueWatching } from '../../hooks/useContinueWatching.js'
import HorizontalRow from './HorizontalRow.js'
import ContinueWatchingCard from './ContinueWatchingCard.js'

export default function ContinueWatchingRow() {
  const { items, loading, dismissItem, dismissError, dismissErrorFor } = useContinueWatching()

  if (loading || items.length === 0) return null

  return (
    <div className="px-8 mt-8">
      <HorizontalRow title="Continuer à regarder">
        {items.map((item) => (
          <ContinueWatchingCard
            key={item.id}
            item={item}
            onDismiss={dismissItem}
            dismissError={item.mediaId === dismissErrorFor ? dismissError : null}
          />
        ))}
      </HorizontalRow>
    </div>
  )
}
