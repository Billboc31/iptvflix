import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import GenreChips from '../components/content/GenreChips.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import Skeleton from '../components/ui/Skeleton.js'
import { useMovies } from '../hooks/useMovies.js'
import { useGenres } from '../hooks/useGenres.js'

export default function MoviesPage() {
  const navigate = useNavigate()
  const [selectedGenreId, setSelectedGenreId] = useState<string | undefined>(undefined)

  const { genres } = useGenres()

  const { data: heroAvailableData } = useMovies({
    pageSize: 1,
    sortBy: 'recentAvailability',
    availability: 'AVAILABLE',
  })
  const { data: heroFallbackData } = useMovies({ pageSize: 1, sortBy: 'recentAvailability' })

  const shelfAFilters = selectedGenreId
    ? { pageSize: 20, genreId: selectedGenreId }
    : { pageSize: 20, sortBy: 'recentAvailability' as const, availability: 'AVAILABLE' as const }

  const { data: shelfAData, loading: shelfALoading } = useMovies(shelfAFilters)
  const { data: shelfBData, loading: shelfBLoading } = useMovies({
    pageSize: 20,
    sortBy: 'title',
  })

  const heroMovie = heroAvailableData?.items[0] ?? heroFallbackData?.items[0]

  const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Cinematic hero */}
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
          onDetails={() => navigate(`/movies/${heroMovie.id}`)}
        />
      )}

      {/* Compact genre selector */}
      <GenreChips genres={genres} selected={selectedGenreId} onSelect={setSelectedGenreId} />

      {/* Shelves */}
      {selectedGenreId ? (
        <HorizontalRow title={selectedGenreName ?? 'Films'}>
          {shelfALoading && (
            <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
          )}
          {shelfAData?.items.map((movie) => (
            <div key={movie.id} className="shrink-0 w-28 md:w-32 lg:w-36">
              <PosterCard
                title={movie.title}
                year={movie.year}
                posterUrl={movie.posterUrl}
                quality={movie.quality}
                mediaId={movie.id}
                trailerKey={movie.trailerKey}
                onClick={() => navigate(`/movies/${movie.id}`)}
              />
            </div>
          ))}
        </HorizontalRow>
      ) : (
        <>
          <HorizontalRow title="Disponibles">
            {shelfALoading && (
              <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
            )}
            {shelfAData?.items.map((movie) => (
              <div key={movie.id} className="shrink-0 w-28 md:w-32 lg:w-36">
                <PosterCard
                  title={movie.title}
                  year={movie.year}
                  posterUrl={movie.posterUrl}
                  quality={movie.quality}
                  mediaId={movie.id}
                  trailerKey={movie.trailerKey}
                  onClick={() => navigate(`/movies/${movie.id}`)}
                />
              </div>
            ))}
          </HorizontalRow>

          <HorizontalRow title="Tous les films">
            {shelfBLoading && (
              <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
            )}
            {shelfBData?.items.map((movie) => (
              <div key={movie.id} className="shrink-0 w-28 md:w-32 lg:w-36">
                <PosterCard
                  title={movie.title}
                  year={movie.year}
                  posterUrl={movie.posterUrl}
                  quality={movie.quality}
                  mediaId={movie.id}
                  trailerKey={movie.trailerKey}
                  onClick={() => navigate(`/movies/${movie.id}`)}
                />
              </div>
            ))}
          </HorizontalRow>
        </>
      )}
    </div>
  )
}
