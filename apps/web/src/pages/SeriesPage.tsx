import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import GenreChips from '../components/content/GenreChips.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import Skeleton from '../components/ui/Skeleton.js'
import { useSeries } from '../hooks/useSeries.js'
import { useGenres } from '../hooks/useGenres.js'

type AvailabilityMode = 'all' | 'available'

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
  const navigate = useNavigate()
  const { data, loading } = useSeries({ pageSize: 20, sortBy, availability, upcoming, genreId })

  if (!loading && (!data?.items.length)) return null

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
            badge={
              s.availabilityStatus === 'UNAVAILABLE'
                ? { label: 'Indisponible', variant: 'unavailable' }
                : undefined
            }
            mediaId={s.id}
            onClick={() => navigate(`/series/${s.id}`)}
          />
        </div>
      ))}
    </HorizontalRow>
  )
}

export default function SeriesPage() {
  const navigate = useNavigate()
  const [selectedGenreId, setSelectedGenreId] = useState<string | undefined>(undefined)
  const [availabilityMode, setAvailabilityMode] = useState<AvailabilityMode>('all')

  const { genres } = useGenres()

  const { data: heroData } = useSeries({ pageSize: 1, sortBy: 'popularity' })
  const heroSeries = heroData?.items[0]

  const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name
  const avail = availabilityMode === 'available' ? 'AVAILABLE' as const : undefined

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {heroSeries && (
        <HeroSection
          title={heroSeries.title}
          synopsis={heroSeries.synopsis}
          backdropUrl={heroSeries.backdropUrl}
          mediaId={heroSeries.id}
          availabilityStatus={heroSeries.availabilityStatus}
          onDetails={() => navigate(`/series/${heroSeries.id}`)}
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
        <SeriesShelf title={selectedGenreName ?? 'Séries'} genreId={selectedGenreId} availability={avail} />
      ) : (
        <>
          {availabilityMode === 'available' && (
            <SeriesShelf title="Disponibles" sortBy="recentAvailability" availability="AVAILABLE" />
          )}
          <SeriesShelf title="Populaires" sortBy="popularity" availability={avail} />
          <SeriesShelf title="Les mieux notées" sortBy="voteAverage" availability={avail} />
          <SeriesShelf title="Sorties récentes" sortBy="year" availability={avail} />
          <SeriesShelf title="À venir" upcoming={true} availability={avail} />
        </>
      )}
    </div>
  )
}
