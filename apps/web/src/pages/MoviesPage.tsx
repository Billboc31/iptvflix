import { Component, useEffect, useRef, useState } from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import GenreChips from '../components/content/GenreChips.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import ShelfRow from '../components/content/ShelfRow.js'
import Skeleton from '../components/ui/Skeleton.js'
import Spinner from '../components/ui/Spinner.js'
import { useInfiniteMovies } from '../hooks/useInfiniteMovies.js'
import { useMovies } from '../hooks/useMovies.js'
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

  componentDidCatch(error: Error, _info: ErrorInfo) {
    console.error('[ShelfErrorBoundary]', error)
  }

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

function MovieShelf({
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
  const { data, loading } = useMovies({ pageSize: 20, sortBy, availability, upcoming, genreId })

  if (!loading && !data?.items.length) return null

  return (
    <HorizontalRow title={title}>
      {loading && (
        <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
      )}
      {data?.items.map((movie) => (
        <div key={movie.id} className="shrink-0 w-28 md:w-32 lg:w-36">
          <PosterCard
            title={movie.title}
            year={movie.year}
            posterUrl={movie.posterUrl}
            quality={movie.quality}
            badge={
              movie.availabilityStatus === 'UNAVAILABLE'
                ? { label: 'Indisponible', variant: 'unavailable' }
                : undefined
            }
            mediaId={movie.id}
            trailerKey={movie.trailerKey}
            onClick={() => openDetail('movie', movie.id)}
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
  } = useInfiniteMovies(currentProfile?.id ?? '', profileVersion)

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

export default function MoviesPage() {
  const navigate = useNavigate()
  const openDetail = useOpenDetail()
  const [selectedGenreId, setSelectedGenreId] = useState<string | undefined>(undefined)
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('all')

  const { genres } = useGenres()
  const { data: heroData } = useMovies({ pageSize: 1, sortBy: 'popularity' })
  const heroMovie = heroData?.items[0]

  const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name
  const avail = availabilityMode === 'available' ? ('AVAILABLE' as const) : undefined
  const browsingCatalog = selectedGenreId != null || availabilityMode === 'available'

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {heroMovie && (
        <HeroSection
          title={heroMovie.title}
          synopsis={heroMovie.synopsis}
          backdropUrl={heroMovie.backdropUrl}
          mediaId={heroMovie.id}
          trailerKey={heroMovie.trailerKey}
          availabilityStatus={heroMovie.availabilityStatus}
          onPlay={
            heroMovie.availabilityStatus === 'AVAILABLE'
              ? () => navigate(`/player/movie/${heroMovie.id}`)
              : undefined
          }
          onDetails={() => openDetail('movie', heroMovie.id)}
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
          <MovieShelf title={selectedGenreName ?? 'Films'} genreId={selectedGenreId} availability={avail} />
        ) : (
          <>
            <MovieShelf title="Disponibles" sortBy="recentAvailability" availability="AVAILABLE" />
            <MovieShelf title="Populaires" sortBy="popularity" availability={avail} />
            <MovieShelf title="Les mieux notés" sortBy="voteAverage" availability={avail} />
            <MovieShelf title="Sorties récentes" sortBy="year" availability={avail} />
            <MovieShelf title="À venir" upcoming availability={avail} />
          </>
        )
      )}

      <PersonalizedShelves />
    </div>
  )
}
