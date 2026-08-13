import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import GenreChips from '../components/content/GenreChips.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import Skeleton from '../components/ui/Skeleton.js'
import { useSeries } from '../hooks/useSeries.js'
import { useGenres } from '../hooks/useGenres.js'

export default function SeriesPage() {
  const navigate = useNavigate()
  const [selectedGenreId, setSelectedGenreId] = useState<string | undefined>(undefined)

  const { genres } = useGenres()

  const { data: heroAvailableData } = useSeries({
    pageSize: 1,
    sortBy: 'recentAvailability',
    availability: 'AVAILABLE',
  })
  const { data: heroFallbackData } = useSeries({ pageSize: 1, sortBy: 'recentAvailability' })

  const shelfAFilters = selectedGenreId
    ? { pageSize: 20, genreId: selectedGenreId }
    : { pageSize: 20, sortBy: 'recentAvailability' as const, availability: 'AVAILABLE' as const }

  const { data: shelfAData, loading: shelfALoading } = useSeries(shelfAFilters)
  const { data: shelfBData, loading: shelfBLoading } = useSeries({
    pageSize: 20,
    sortBy: 'title',
  })

  const heroSeries = heroAvailableData?.items[0] ?? heroFallbackData?.items[0]

  const selectedGenreName = genres.find((g) => g.id === selectedGenreId)?.name

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Cinematic hero — no onPlay for series (episode-driven playability) */}
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

      {/* Compact genre selector */}
      <GenreChips genres={genres} selected={selectedGenreId} onSelect={setSelectedGenreId} />

      {/* Shelves */}
      {selectedGenreId ? (
        <HorizontalRow title={selectedGenreName ?? 'Séries'}>
          {shelfALoading && (
            <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
          )}
          {shelfAData?.items.map((series) => (
            <div key={series.id} className="shrink-0 w-28 md:w-32 lg:w-36">
              <PosterCard
                title={series.title}
                year={series.year}
                posterUrl={series.posterUrl}
                mediaId={series.id}
                onClick={() => navigate(`/series/${series.id}`)}
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
            {shelfAData?.items.map((series) => (
              <div key={series.id} className="shrink-0 w-28 md:w-32 lg:w-36">
                <PosterCard
                  title={series.title}
                  year={series.year}
                  posterUrl={series.posterUrl}
                  mediaId={series.id}
                  onClick={() => navigate(`/series/${series.id}`)}
                />
              </div>
            ))}
          </HorizontalRow>

          <HorizontalRow title="Toutes les séries">
            {shelfBLoading && (
              <Skeleton className="shrink-0 w-28 md:w-32 lg:w-36 aspect-[2/3] rounded-lg" />
            )}
            {shelfBData?.items.map((series) => (
              <div key={series.id} className="shrink-0 w-28 md:w-32 lg:w-36">
                <PosterCard
                  title={series.title}
                  year={series.year}
                  posterUrl={series.posterUrl}
                  mediaId={series.id}
                  onClick={() => navigate(`/series/${series.id}`)}
                />
              </div>
            ))}
          </HorizontalRow>
        </>
      )}
    </div>
  )
}
