import HorizontalRow from './HorizontalRow.js'
import PosterCard from './PosterCard.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

type ShelfRowProps = {
  shelf: ShelfResponse
}

export default function ShelfRow({ shelf }: ShelfRowProps) {
  if (shelf.items.length === 0) return null

  return (
    <div className="px-8 mt-8">
      <HorizontalRow title={shelf.title}>
        {shelf.items.map((item) => {
          const hasProgress =
            item.progressSeconds != null &&
            item.durationSeconds != null &&
            item.durationSeconds > 0
          const pct = hasProgress
            ? Math.round((item.progressSeconds! / item.durationSeconds!) * 100)
            : 0

          return (
            <div key={`${item.mediaType}-${item.mediaId}`} className="relative flex-shrink-0 w-36">
              <PosterCard title={item.title} posterUrl={item.posterUrl} />
              {hasProgress && (
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
              )}
            </div>
          )
        })}
      </HorizontalRow>
    </div>
  )
}
