import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import ShelfRow from '../components/content/ShelfRow.js'
import GenerateShelfDialog from '../components/content/GenerateShelfDialog.js'
import ArrivalCard from '../components/content/ArrivalCard.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import EmptyState from '../components/ui/EmptyState.js'
import Spinner from '../components/ui/Spinner.js'
import Button from '../components/ui/Button.js'
import { useFeaturedMedia } from '../hooks/useFeaturedMedia.js'
import { useHome } from '../hooks/useHome.js'
import { useArrivals } from '../hooks/useArrivals.js'
import { useOpenDetail } from '../hooks/useOpenDetail.js'

const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

export default function HomePage() {
  const navigate = useNavigate()
  const openDetail = useOpenDetail()
  const { media: hero, loading: heroLoading } = useFeaturedMedia()
  const { data: homeData, isLoading: homeLoading } = useHome(DEFAULT_PROFILE_ID)
  const { arrivals, refresh: refreshArrivals } = useArrivals('unread')
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)

  const shelves = homeData?.shelves ?? []
  const isLoading = heroLoading || homeLoading
  const hasContent = hero !== null || shelves.length > 0
  const isColdStart = homeData?.coldStart === true && shelves.length === 0

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

  return (
    <div>
      {/* Hero */}
      {hero && (
        <HeroSection
          title={hero.title}
          synopsis={hero.synopsis}
          backdropUrl={hero.backdropUrl}
          posterUrl={hero.posterUrl}
          mediaId={hero.id}
          trailerKey={hero.trailerKey}
          availabilityStatus={hero.availabilityStatus}
          onPlay={
            hero.availabilityStatus === 'AVAILABLE' && hero.mediaType === 'movie'
              ? () => navigate(`/player/movie/${hero.id}`)
              : undefined
          }
          onDetails={() => openDetail(hero.mediaType, hero.id)}
        />
      )}

      {isLoading && <Spinner />}

      {/* New arrivals shelf */}
      {arrivals.length > 0 && (
        <div className="px-8 mt-2">
          <HorizontalRow title="Nouveautés disponibles">
            {arrivals.map((arrival) => (
              <ArrivalCard
                key={arrival.id}
                arrival={arrival}
                onDismiss={refreshArrivals}
              />
            ))}
          </HorizontalRow>
        </div>
      )}

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
