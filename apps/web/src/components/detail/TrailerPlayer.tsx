import { useState } from 'react'

interface TrailerPlayerProps {
  trailerKey: string | null
  title: string
}

export default function TrailerPlayer({ trailerKey, title }: TrailerPlayerProps) {
  const [playing, setPlaying] = useState(false)

  if (!trailerKey) return null

  if (playing) {
    return (
      <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1`}
          title={`Trailer — ${title}`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    )
  }

  return (
    <div className="mb-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Bande-annonce</p>
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-white text-sm font-medium"
        aria-label={`Lire la bande-annonce de ${title}`}
      >
        <span className="text-xl">▶</span>
        Lire la bande-annonce
      </button>
    </div>
  )
}
