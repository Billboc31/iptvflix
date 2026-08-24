import { Component, useState, useEffect, useRef } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import ShelfRow from '../components/content/ShelfRow.js'
import GenerateShelfDialog from '../components/content/GenerateShelfDialog.js'
import ContinueWatchingRow from '../components/content/ContinueWatchingRow.js'
import ArrivalCard from '../components/content/ArrivalCard.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import EmptyState from '../components/ui/EmptyState.js'
import ErrorState from '../components/ui/ErrorState.js'
import Skeleton from '../components/ui/Skeleton.js'
import Spinner from '../components/ui/Spinner.js'
import Button from '../components/ui/Button.js'
import { useInfiniteHome } from '../hooks/useHome.js'
import { useArrivals } from '../hooks/useArrivals.js'
import { useOpenDetail } from '../hooks/useOpenDetail.js'
import { useProfile } from '../context/ProfileContext.js'
import { useInteractionEvents } from '../hooks/useInteractionEvents.js'

class ShelfErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

function ShelfSkeleton() {
  return (
    <div className="px-8 mt-6">
      <Skeleton className="w-48 h-5 mb-3" />
      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="w-36 h-52 flex-shrink-0" />
        ))}
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const openDetail = useOpenDetail()
  const { currentProfile, profileVersion } = useProfile()
  const {
    allShelves,
    hero,
    isLoading: homeLoading,
    isFetchingMore,
    hasMore,
    error: homeError,
    loadMore,
  } = useInfiniteHome(currentProfile?.id ?? '', profileVersion)
  const { arrivals, refresh: refreshArrivals } = useArrivals('unread')
  const { emit: emitEvent } = useInteractionEvents()
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    emitEvent({ eventType: 'HOME_OPENED', clientType: 'web' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileVersion])

  // IntersectionObserver: call loadMore when sentinel enters viewport.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore()
      },
      { rootMargin: '400px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loadMore])

  const recShelves = allShelves.filter((shelf) => shelf.id !== 'sys_continue_watching')
  const isLoading = homeLoading
  const hasContent = recShelves.length > 0 || hero !== null

  if (!isLoading && !hasContent) {
    return (
      <div>
        <ContinueWatchingRow />
        <EmptyState
          icon="📡"
          heading="Aucun contenu disponible"
          description="Ajoutez une source IPTV pour commencer à explorer votre catalogue."
          action={
            <Button onClick={() => navigate('/sources')}>Ajouter une source</Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      {/* Hero — only rendered when a quality-gated hero exists */}
      {hero && (
        <HeroSection
          title={hero.title}
          synopsis={hero.synopsis}
          backdropUrl={hero.backdropUrl}
          mediaId={hero.mediaId}
          trailerKey={hero.trailerKey}
          availabilityStatus={hero.availabilityStatus}
          onPlay={
            hero.availabilityStatus === 'AVAILABLE'
              ? () => navigate(`/player/${hero.mediaType === 'MOVIE' ? 'movie' : 'series'}/${hero.mediaId}`)
              : undefined
          }
          onDetails={() => openDetail(hero.mediaType === 'MOVIE' ? 'movie' : 'series', hero.mediaId)}
          onAddToList={() => {}}
        />
      )}

      {isLoading && <Spinner />}

      <ContinueWatchingRow />

      {/* New arrivals shelf */}
      {arrivals.length > 0 && (
        <div className="px-8 mt-8">
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
      {!homeLoading && homeError && recShelves.length === 0 && (
        <ErrorState
          message="Impossible de charger les recommandations. Le catalogue reste disponible via Films."
          onRetry={() => window.location.reload()}
        />
      )}
      {homeLoading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {!homeLoading && (
        <>
          <div className="flex justify-end px-4 py-2">
            <Button variant="secondary" size="sm" onClick={() => setGenerateDialogOpen(true)}>
              + Créer une sélection
            </Button>
          </div>
          {recShelves.map((shelf) => (
            <ShelfErrorBoundary key={shelf.id}>
              <ShelfRow shelf={shelf} />
            </ShelfErrorBoundary>
          ))}
        </>
      )}

      {/* Loading skeleton for next batch */}
      {isFetchingMore && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}

      {/* Sentinel for IntersectionObserver */}
      {hasMore && !isFetchingMore && <div ref={sentinelRef} aria-hidden="true" />}

      {/* End-of-feed indicator */}
      {!hasMore && recShelves.length > 0 && (
        <p className="text-center text-sm text-gray-600 py-8">— Fin des recommandations —</p>
      )}

      <GenerateShelfDialog
        open={generateDialogOpen}
        onClose={() => setGenerateDialogOpen(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
