import type { ChannelResponse } from '@iptvflix/api-contracts'
import ChannelCard from './ChannelCard.js'

type Props = {
  title: string
  channels: ChannelResponse[]
  isLoading: boolean
  onToggleFavorite?: (id: string) => void
  favoriteIds?: Set<string>
}

function Skeleton() {
  return (
    <div className="shrink-0 w-56 bg-[#111118] border border-white/5 rounded-xl p-4 animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 bg-white/5 rounded" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-white/5 rounded w-3/4" />
          <div className="h-2 bg-white/5 rounded w-1/2" />
        </div>
      </div>
      <div className="h-0.5 bg-white/5 rounded" />
    </div>
  )
}

export default function LiveRail({ title, channels, isLoading, onToggleFavorite, favoriteIds }: Props) {
  if (!isLoading && channels.length === 0) return null

  return (
    <section aria-label={title}>
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <div
        className="flex gap-4 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none' }}
      >
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} />)
          : channels.map((ch) => (
              <div key={ch.id} className="shrink-0 w-56">
                <ChannelCard
                  channel={ch}
                  isFavorite={favoriteIds?.has(ch.id)}
                  onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(ch.id) : undefined}
                />
              </div>
            ))}
      </div>
    </section>
  )
}
