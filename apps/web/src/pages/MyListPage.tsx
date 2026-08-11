import { useWatchlist } from '../hooks/useWatchlist.js'
import EmptyState from '../components/ui/EmptyState.js'
import PosterCard from '../components/content/PosterCard.js'

export default function MyListPage() {
  const { entries, loading, remove } = useWatchlist()

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-400">Chargement…</div>
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon="♡"
        heading="Votre liste est vide"
        description="Ajoutez des films et séries à regarder plus tard."
      />
    )
  }

  return (
    <div className="px-8 py-8">
      <h1 className="text-2xl font-semibold text-white mb-6">Ma liste</h1>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4">
        {entries.map((entry) => (
          <div key={entry.id} className="relative group">
            <PosterCard
              title={entry.title}
              posterUrl={entry.posterUrl}
            />
            <button
              onClick={() => remove(entry.mediaType, entry.mediaId)}
              aria-label="Retirer de Ma liste"
              className="absolute top-1 left-1 z-10 w-6 h-6 rounded-full bg-black/70 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
