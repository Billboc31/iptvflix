import { useState } from 'react'
import { useArrivals } from '../hooks/useArrivals.js'
import ArrivalCard from '../components/content/ArrivalCard.js'
import Spinner from '../components/ui/Spinner.js'
import EmptyState from '../components/ui/EmptyState.js'

export default function ArrivalsPage() {
  const [filter, setFilter] = useState<'unread' | 'all'>('unread')
  const { arrivals, isLoading, refresh } = useArrivals(filter)

  function handleDismiss(_id: string) {
    refresh()
  }

  return (
    <div className="px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Nouveautés disponibles</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'unread'
                ? 'bg-[#e50914] text-white'
                : 'bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            Non lues
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded text-sm transition-colors ${
              filter === 'all'
                ? 'bg-[#e50914] text-white'
                : 'bg-white/10 text-gray-400 hover:text-white'
            }`}
          >
            Toutes
          </button>
        </div>
      </div>

      {isLoading && <Spinner />}

      {!isLoading && arrivals.length === 0 && (
        <EmptyState
          icon="🎉"
          heading="Aucune nouveauté"
          description="Les contenus que vous suivez apparaîtront ici dès qu'ils seront disponibles sur vos sources."
        />
      )}

      {!isLoading && arrivals.length > 0 && (
        <div className="flex flex-wrap gap-4">
          {arrivals.map((arrival) => (
            <ArrivalCard
              key={arrival.id}
              arrival={arrival}
              onDismiss={filter === 'unread' ? handleDismiss : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
