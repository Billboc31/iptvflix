import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import HeroSection from '../components/content/HeroSection.js'
import GenreChips from '../components/content/GenreChips.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import ShelfRow from '../components/content/ShelfRow.js'
import Skeleton from '../components/ui/Skeleton.js'
import Spinner from '../components/ui/Spinner.js'
import { useInfiniteSeriesPage } from '../hooks/useSeriesPage.js'
import { useSeries } from '../hooks/useSeries.js'
import { useGenres } from '../hooks/useGenres.js'
import { useOpenDetail } from '../hooks/useOpenDetail.js'
import { useProfile } from '../context/ProfileContext.js'

type AvailabilityMode = 'all' | 'available'

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

function SeriesShelf({
  title,
  sortBy,
  availability,
  upcoming,
  genreId,
}: {
  title: string
  sortBy?: 'popularity' | 'voteAverage' | 'year' | 'recentAvailability'
  availability?: 'AVAILABLE'
  upcoming?: boolean
  genreId?: string
}) {
  const openDetail = useOpenDetail()
  const { data, loading } = useSeries({ pageSize: 20, sortBy, availability, upcoming, genreId })

  if (!loading && !data?.items.length) return null

  return (
    <HorizontalRow title={title}>
      {loading && (
        <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
      )}
      {data?.items.map((s) => (
        <div key={s.id} className="shrink-0 w-28 md:w-32 lg:w-36">
          <PosterCard
            title={s.title}
            year={s.year}
            posterUrl={s.posterUrl}
            mediaId={s.id}
            onClick={() => openDetail('series', s.id)}
          />
        </div>
      ))}
    </HorizontalRow>
  )
}

function PersonalizedShelves() {
  const { currentProfile, profileVersion } = useProfile()
  const {
    allShelves,
    isLoading,
    isFetchingMore,
    hasMore,
    loadMore,
  } = useInfiniteSeriesPage(currentProfile?.id ?? '', profileVersion)

  const sentinelRef = useRef<HTMLDivElement | null>(null)

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

  return (
    <section>
      {isLoading && <Spinner />}

      {isLoading && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}

      {!isLoading && allShelves.map((shelf) => (
        <ShelfErrorBoundary key={shelf.id}>
          <ShelfRow shelf={shelf} />
        </ShelfErrorBoundary>
      ))}

      {isFetchingMore && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}

      {hasMore && !isFetchingMore && <div ref={sentinelRef} aria-hidden="true" />}

      {!hasMore && allShelves.length > 0 && (
        <p className="text-center text-sm text-gray-600 py-8">— Fin des recommandations —</p>
      )}
    </section>
  )
}

export default function SeriesPage() {
  const openDetail = useOpenDetail()
  const [selectedGenreId, setSelectedGenreId] = useState<string | undefined>(undefined)
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('all')

  const { genres } = useGenres()
  const { data: heroData } = useSeries({ pageSize: 1, sortBy: 'popularity' })
  const heroSeries = heroData?.items[0]

  const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name
  const avail = availabilityMode === 'available' ? ('AVAILABLE' as const) : undefined
  const browsingCatalog = selectedGenreId != null || availabilityMode === 'available'

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {heroSeries && (
        <HeroSection
          title={heroSeries.title}
          synopsis={heroSeries.synopsis}
          backdropUrl={heroSeries.backdropUrl}
          mediaId={heroSeries.id}
          availabilityStatus={heroSeries.availabilityStatus}
          onDetails={() => openDetail('series', heroSeries.id)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={() => setAvailabilityMode('all')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            availabilityMode === 'all'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          Tout le catalogue
        </button>
        <button
          type="button"
          onClick={() => setAvailabilityMode('available')}
          className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
            availabilityMode === 'available'
              ? 'bg-white text-black'
              : 'bg-white/10 text-white hover:bg-white/20'
          }`}
        >
          Disponible maintenant
        </button>
      </div>

      <GenreChips genres={genres} selected={selectedGenreId} onSelect={setSelectedGenreId} />

      {browsingCatalog && (
        selectedGenreId ? (
          <SeriesShelf title={selectedGenreName ?? 'Séries'} genreId={selectedGenreId} availability={avail} />
        ) : (
          <>
            <SeriesShelf title="Disponibles" sortBy="recentAvailability" availability="AVAILABLE" />
            <SeriesShelf title="Populaires" sortBy="popularity" availability={avail} />
            <SeriesShelf title="Les mieux notées" sortBy="voteAverage" availability={avail} />
            <SeriesShelf title="Sorties récentes" sortBy="year" availability={avail} />
            <SeriesShelf title="À venir" upcoming availability={avail} />
          </>
        )
      )}

      <PersonalizedShelves />
    </div>
  )
}
