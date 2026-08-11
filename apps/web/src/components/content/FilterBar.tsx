import type { MovieFilters, SeriesFilters } from '@iptvflix/api-contracts'

type Filters = MovieFilters | SeriesFilters

type FilterBarProps = {
  value: Filters
  onChange: (filters: Filters) => void
  showQuality?: boolean
  genres?: { id: string; name: string }[]
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i)
const QUALITIES = ['HD', '4K', 'SD']

export default function FilterBar({
  value,
  onChange,
  showQuality = false,
  genres = [],
}: FilterBarProps) {
  const handleChange = (key: string, val: string) => {
    onChange({
      ...value,
      [key]: val === '' ? undefined : key === 'year' ? Number(val) : val,
      page: 1,
    })
  }

  return (
    <div className="flex flex-wrap gap-3 mb-6">
      {/* Genre */}
      <select
        value={('genreId' in value && value.genreId) || ''}
        onChange={(e) => handleChange('genreId', e.target.value)}
        className="bg-[#1a1a24] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        aria-label="Filtrer par genre"
      >
        <option value="">Tous les genres</option>
        {genres.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>

      {/* Year */}
      <select
        value={value.year ?? ''}
        onChange={(e) => handleChange('year', e.target.value)}
        className="bg-[#1a1a24] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        aria-label="Filtrer par année"
      >
        <option value="">Toutes les années</option>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>

      {/* Availability */}
      <select
        value={value.availability ?? ''}
        onChange={(e) => handleChange('availability', e.target.value)}
        className="bg-[#1a1a24] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        aria-label="Filtrer par disponibilité"
      >
        <option value="">Toutes disponibilités</option>
        <option value="AVAILABLE">Disponibles</option>
        <option value="UNAVAILABLE">Non disponibles</option>
      </select>

      {/* Sort */}
      <select
        value={value.sortBy ?? ''}
        onChange={(e) => handleChange('sortBy', e.target.value)}
        className="bg-[#1a1a24] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        aria-label="Trier par"
      >
        <option value="">Tri : titre</option>
        <option value="title">Titre</option>
        <option value="year">Année</option>
        <option value="recentAvailability">Récemment disponible</option>
      </select>

      {/* Quality (movies only) */}
      {showQuality && (
        <select
          value={('quality' in value && value.quality) || ''}
          onChange={(e) => handleChange('quality', e.target.value)}
          className="bg-[#1a1a24] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
          aria-label="Filtrer par qualité"
        >
          <option value="">Toutes les qualités</option>
          {QUALITIES.map((q) => (
            <option key={q} value={q}>
              {q}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
