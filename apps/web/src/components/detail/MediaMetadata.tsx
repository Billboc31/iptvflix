import Badge from '../ui/Badge.js'

type Props = {
  title: string
  originalTitle?: string | null
  year?: number | null
  runtime?: number | null
  genres?: string[]
  certification?: string | null
  voteAverage?: number | null
  synopsis?: string | null
  // series-specific
  seasonCount?: number | null
  status?: string | null
}

export default function MediaMetadata({
  title,
  originalTitle,
  year,
  runtime,
  genres = [],
  certification,
  voteAverage,
  synopsis,
  seasonCount,
  status,
}: Props) {
  const showOriginalTitle = originalTitle && originalTitle !== title

  return (
    <div>
      <h1 className="text-2xl md:text-4xl font-bold text-white mb-1">{title}</h1>

      {showOriginalTitle && (
        <p className="text-gray-400 text-base mb-3">{originalTitle}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {year && <span className="text-gray-400 text-sm">{year}</span>}
        {runtime && <span className="text-gray-400 text-sm">{runtime} min</span>}
        {seasonCount != null && seasonCount > 0 && (
          <span className="text-gray-400 text-sm">
            {seasonCount} saison{seasonCount > 1 ? 's' : ''}
          </span>
        )}
        {status && <Badge variant="info">{status}</Badge>}
        {certification && <Badge variant="default">{certification}</Badge>}
        {voteAverage != null && (
          <span className="text-yellow-400 text-sm font-medium">★ {voteAverage.toFixed(1)}</span>
        )}
      </div>

      {genres.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {genres.map((g) => (
            <Badge key={g} variant="info">{g}</Badge>
          ))}
        </div>
      )}

      {synopsis && (
        <p className="text-gray-300 text-sm leading-relaxed mb-6 max-w-2xl">
          {synopsis}
        </p>
      )}
    </div>
  )
}
