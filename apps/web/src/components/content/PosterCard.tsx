import Badge from '../ui/Badge.js'

type PosterCardProps = {
  title: string
  year?: number | null
  posterUrl?: string | null
  quality?: string | null
  onClick?: () => void
}

export default function PosterCard({ title, year, posterUrl, quality, onClick }: PosterCardProps) {
  return (
    <div
      onClick={onClick}
      className="relative flex-shrink-0 w-36 cursor-pointer group"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
    >
      {/* Poster image */}
      <div className="aspect-[2/3] bg-[#1a1a24] rounded-lg overflow-hidden relative">
        {posterUrl ? (
          <img src={posterUrl} alt={title} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-600">
            <span className="text-4xl select-none">🎬</span>
            <span className="text-xs text-center px-2 line-clamp-2">{title}</span>
          </div>
        )}

        {/* Quality badge */}
        {quality && (
          <div className="absolute top-1.5 right-1.5">
            <Badge variant="quality">{quality}</Badge>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="px-3 py-1 bg-white text-black text-xs font-semibold rounded-full">
            Détails
          </span>
        </div>
      </div>

      {/* Title + year */}
      <div className="mt-1.5 px-0.5">
        <p className="text-white text-xs font-medium leading-tight line-clamp-1">{title}</p>
        {year && <p className="text-gray-500 text-xs mt-0.5">{year}</p>}
      </div>
    </div>
  )
}
