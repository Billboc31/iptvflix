import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import ShelfRow from '../components/content/ShelfRow.js'
import GenerateShelfDialog from '../components/content/GenerateShelfDialog.js'
import EmptyState from '../components/ui/EmptyState.js'
import Spinner from '../components/ui/Spinner.js'
import Button from '../components/ui/Button.js'
import { useMovies } from '../hooks/useMovies.js'
import { useHome } from '../hooks/useHome.js'

const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

export default function HomePage() {
  const navigate = useNavigate()
  const { data: movies, loading: moviesLoading } = useMovies({ pageSize: 1 })
  const { data: homeData, isLoading: homeLoading } = useHome(DEFAULT_PROFILE_ID)
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)

  const shelves = homeData?.shelves ?? []
  const isLoading = moviesLoading || homeLoading
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
  const isColdStart = homeData?.coldStart === true && shelves.length === 0

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
      {!homeLoading && (
        <>
          <div className="flex justify-end px-4 py-2">
            <Button variant="secondary" size="sm" onClick={() => setGenerateDialogOpen(true)}>
              + Créer une sélection
            </Button>
          </div>
          {isColdStart && (
            <p className="px-4 py-2 text-sm text-gray-400">
              Commencez à regarder des contenus pour recevoir des recommandations personnalisées.
            </p>
          )}
          {shelves.map((shelf) => (
            <ShelfRow key={shelf.id} shelf={shelf} />
          ))}
        </>
      )}

      <GenerateShelfDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
