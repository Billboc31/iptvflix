import Button from '../ui/Button.js'

type HeroSectionProps = {
  title: string
  synopsis?: string | null
  backdropUrl?: string | null
  onDetails?: () => void
  onAddToList?: () => void
}

export default function HeroSection({
  title,
  synopsis,
  backdropUrl,
  onDetails,
  onAddToList,
}: HeroSectionProps) {
  return (
    <div className="relative h-[56vh] min-h-80 overflow-hidden">
      {/* Backdrop */}
      {backdropUrl ? (
        <img
          src={backdropUrl}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" />
      )}

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-transparent to-transparent" />

      {/* Content */}
      <div className="relative h-full flex flex-col justify-end px-8 pb-10 max-w-2xl">
        <h1 className="text-4xl font-bold text-white mb-3 drop-shadow-lg">{title}</h1>
        {synopsis && (
          <p className="text-gray-300 text-sm leading-relaxed mb-6 line-clamp-3">{synopsis}</p>
        )}
        <div className="flex gap-3">
          {onDetails && <Button onClick={onDetails}>Détails</Button>}
          {onAddToList && (
            <Button variant="secondary" onClick={onAddToList}>
              + Ma Liste
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
