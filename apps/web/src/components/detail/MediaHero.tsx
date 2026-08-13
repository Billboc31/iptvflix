import { useState } from 'react'

type Props = {
  backdropUrl?: string | null
  posterUrl?: string | null
  trailerKey?: string | null
  title: string
}

export default function MediaHero({ backdropUrl, posterUrl, trailerKey, title }: Props) {
  const [showTrailer, setShowTrailer] = useState(false)
  const [backdropError, setBackdropError] = useState(false)
  const [posterError, setPosterError] = useState(false)

  const showBackdrop = !backdropError && !!backdropUrl
  const showPoster = !showBackdrop && !posterError && !!posterUrl

  return (
    <div
      className="relative w-full overflow-hidden bg-[#0a0a0f]"
      style={{ height: 'clamp(300px, 56.25vw, 70vh)' }}
    >
      {showBackdrop && (
        <img
          src={backdropUrl!}
          alt=""
          aria-hidden="true"
          onError={() => setBackdropError(true)}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {showPoster && (
        <img
          src={posterUrl!}
          alt=""
          aria-hidden="true"
          onError={() => setPosterError(true)}
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      )}
      {!showBackdrop && !showPoster && (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a24] to-[#0a0a0f]" />
      )}

      {showTrailer && trailerKey && (
        <div className="absolute inset-0 bg-black z-10">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&rel=0`}
            title={`Trailer — ${title}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      )}

      {/* Bottom gradient blending into page */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#0a0a0f] to-transparent pointer-events-none z-20" />

      {trailerKey && !showTrailer && (
        <div className="absolute bottom-10 left-4 md:left-8 z-30">
          <button
            type="button"
            onClick={() => setShowTrailer(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg text-white text-sm font-medium transition-colors"
            aria-label={`Lire la bande-annonce de ${title}`}
          >
            <span aria-hidden="true">▶</span>
            Bande-annonce
          </button>
        </div>
      )}
    </div>
  )
}
