import { useContinueWatching } from '../../hooks/useContinueWatching.js'
import HorizontalRow from './HorizontalRow.js'
import PosterCard from './PosterCard.js'

export default function ContinueWatchingRow() {
  const { items, loading } = useContinueWatching()

  if (loading || items.length === 0) return null

  return (
    <div className="px-8 mt-8">
      <HorizontalRow title="Continuer à regarder">
        {items.map((item) => {
          const pct = item.durationSeconds > 0
            ? Math.round((item.progressSeconds / item.durationSeconds) * 100)
            : 0
          return (
            <div key={item.id} className="relative flex-shrink-0 w-36">
              <PosterCard title={item.title} posterUrl={item.posterUrl} />
              <div
                className="absolute bottom-6 left-0 right-0 h-1 bg-gray-700 mx-0.5"
                aria-label={`${pct}% visionné`}
              >
                <div
                  className="h-full bg-[#e50914]"
                  style={{ width: `${pct}%` }}
                  data-testid="progress-bar"
                />
              </div>
            </div>
          )
        })}
      </HorizontalRow>
    </div>
  )
}
