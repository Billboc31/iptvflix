import type { GenreResponse } from '@iptvflix/api-contracts'

type GenreChipsProps = {
  genres: GenreResponse[]
  selected: string | undefined
  onSelect: (genreId: string | undefined) => void
}

export default function GenreChips({ genres, selected, onSelect }: GenreChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide px-4 md:px-8 py-3">
      <button
        onClick={() => onSelect(undefined)}
        className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
          selected === undefined
            ? 'bg-[#e50914] text-white'
            : 'bg-white/10 text-gray-300 hover:bg-white/20'
        }`}
      >
        Tous
      </button>
      {genres.map((genre) => (
        <button
          key={genre.id}
          onClick={() => onSelect(genre.id)}
          className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selected === genre.id
              ? 'bg-[#e50914] text-white'
              : 'bg-white/10 text-gray-300 hover:bg-white/20'
          }`}
        >
          {genre.name}
        </button>
      ))}
    </div>
  )
}
