import { useNavigate } from 'react-router-dom'
import HeroSection from '../components/content/HeroSection.js'
import HorizontalRow from '../components/content/HorizontalRow.js'
import PosterCard from '../components/content/PosterCard.js'
import EmptyState from '../components/ui/EmptyState.js'
import Spinner from '../components/ui/Spinner.js'
import Button from '../components/ui/Button.js'
import { useMovies } from '../hooks/useMovies.js'
import { useSeries } from '../hooks/useSeries.js'

export default function HomePage() {
  const navigate = useNavigate()
  const { data: movies, loading: moviesLoading } = useMovies({ pageSize: 20 })
  const { data: series, loading: seriesLoading } = useSeries({ pageSize: 20 })

  const isLoading = moviesLoading || seriesLoading
  const hasContent = (movies?.items.length ?? 0) > 0 || (series?.items.length ?? 0) > 0

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

      {/* Films row */}
      {!moviesLoading && movies && movies.items.length > 0 && (
        <div className="px-8 mt-8">
          <HorizontalRow title="Récemment ajoutés — Films">
            {movies.items.slice(0, 12).map((m) => (
              <PosterCard
                key={m.id}
                title={m.title}
                year={m.year}
                posterUrl={m.posterUrl}
                quality={m.quality}
                onClick={() => navigate(`/movies/${m.id}`)}
              />
            ))}
          </HorizontalRow>
        </div>
      )}

      {/* Series row */}
      {!seriesLoading && series && series.items.length > 0 && (
        <div className="px-8 mt-2 pb-10">
          <HorizontalRow title="Récemment ajoutées — Séries">
            {series.items.slice(0, 12).map((s) => (
              <PosterCard
                key={s.id}
                title={s.title}
                year={s.year}
                posterUrl={s.posterUrl}
                onClick={() => navigate(`/series/${s.id}`)}
              />
            ))}
          </HorizontalRow>
        </div>
      )}
    </div>
  )
}
