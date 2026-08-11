import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import ShelfRow from '../components/content/ShelfRow.js'
import EmptyState from '../components/ui/EmptyState.js'
import Spinner from '../components/ui/Spinner.js'
import Button from '../components/ui/Button.js'
import { useMovies } from '../hooks/useMovies.js'
import { useShelves } from '../hooks/useShelves.js'
import { useShelf } from '../hooks/useShelf.js'
import type { ShelfSummaryResponse } from '@iptvflix/api-contracts'

function ShelfRowLoader({ summary }: { summary: ShelfSummaryResponse }) {
  const { shelf } = useShelf(summary.id)
  if (!shelf) return null
  return <ShelfRow shelf={shelf} />
}

function ShelfRows({ shelves }: { shelves: ShelfSummaryResponse[] }) {
  return (
    <>
      {shelves.map((summary) => (
        <ShelfRowLoader key={summary.id} summary={summary} />
      ))}
    </>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const { data: movies, loading: moviesLoading } = useMovies({ pageSize: 1 })
  const { shelves, loading: shelvesLoading } = useShelves()

  const isLoading = moviesLoading || shelvesLoading
  const hasContent = (movies?.items.length ?? 0) > 0 || shelves.length > 0

  if (!isLoading && !hasContent) {
    return (
      <EmptyState
        icon="📡"
        heading="Aucun contenu disponible"
        description="Ajoutez une source IPTV pour commencer à explorer votre catalogue."
        action={
          <Button onClick={() => navigate('/sources')}>Ajouter une source</Button>
        }
      />
    )
  }

  const hero = movies?.items[0]

  return (
    <div>
      {/* Hero */}
      {hero && (
        <HeroSection
          title={hero.title}
          synopsis={hero.synopsis}
          backdropUrl={hero.backdropUrl}
          onDetails={() => navigate(`/movies/${hero.id}`)}
          onAddToList={() => {}}
        />
      )}

      {isLoading && <Spinner />}

      {/* Shelf rows */}
      {!shelvesLoading && <ShelfRows shelves={shelves} />}
    </div>
  )
}
