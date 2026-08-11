import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SeriesFilters } from '@iptvflix/api-contracts'
import FilterBar from '../components/content/FilterBar.js'
import PosterGrid from '../components/content/PosterGrid.js'
import Skeleton from '../components/ui/Skeleton.js'
import EmptyState from '../components/ui/EmptyState.js'
import ErrorState from '../components/ui/ErrorState.js'
import { useSeries } from '../hooks/useSeries.js'

export default function SeriesPage() {
  const navigate = useNavigate()
  const [filters, setFilters] = useState<SeriesFilters>({ page: 1, pageSize: 20 })
  const { data, loading, error, refetch } = useSeries(filters)

  return (
    <div className="px-8 py-6">
      <h1 className="text-3xl font-bold text-white mb-6">Séries</h1>

      <FilterBar
        value={filters}
        onChange={(f) => setFilters(f as SeriesFilters)}
      />

      {loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[2/3] w-full rounded-lg" />
          ))}
        </div>
      )}

      {!loading && error && <ErrorState message={error.message} onRetry={refetch} />}

      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          icon="📺"
          heading="Aucune série trouvée"
          description="Essayez d'autres filtres ou ajoutez une source IPTV."
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <PosterGrid items={data.items} onItemClick={(id) => navigate(`/series/${id}`)} />
      )}
    </div>
  )
}
