import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import GenreChips from '../components/content/GenreChips.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import Skeleton from '../components/ui/Skeleton.js'
import { useMovies } from '../hooks/useMovies.js'
import { useGenres } from '../hooks/useGenres.js'

type AvailabilityMode = 'all' | 'available'

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
  const navigate = useNavigate()
  const { data, loading } = useMovies({ pageSize: 20, sortBy, availability, upcoming, genreId })

  if (!loading && (!data?.items.length)) return null

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
            mediaId={movie.id}
            trailerKey={movie.trailerKey}
            onClick={() => navigate(`/movies/${movie.id}`)}
          />
        </div>
      ))}
    </HorizontalRow>
  )
}

export default function MoviesPage() {
  const navigate = useNavigate()
  const [selectedGenreId, setSelectedGenreId] = useState<string | undefined>(undefined)
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('all')

  const { genres } = useGenres()

  const { data: heroData } = useMovies({ pageSize: 1, sortBy: 'popularity' })
  const heroMovie = heroData?.items[0]

  const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name
  const avail = availabilityMode === 'available' ? 'AVAILABLE' as const : undefined

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
          onDetails={() => navigate(`/movies/${heroMovie.id}`)}
        />
      )}

      <div className="flex flex-wrap items-center gap-2 px-4 pt-4">
        <button
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

      {selectedGenreId ? (
        <MovieShelf title={selectedGenreName ?? 'Films'} genreId={selectedGenreId} availability={avail} />
      ) : (
        <>
          {availabilityMode === 'available' && (
            <MovieShelf title="Disponibles" sortBy="recentAvailability" availability="AVAILABLE" />
          )}
          <MovieShelf title="Populaires" sortBy="popularity" availability={avail} />
          <MovieShelf title="Les mieux notés" sortBy="voteAverage" availability={avail} />
          <MovieShelf title="Sorties récentes" sortBy="year" availability={avail} />
          <MovieShelf title="À venir" upcoming={true} availability={avail} />
        </>
      )}
    </div>
  )
}
