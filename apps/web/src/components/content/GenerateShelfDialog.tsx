import { useState, useCallback } from 'react'
import Dialog from '../ui/Dialog.js'
import Button from '../ui/Button.js'
import { searchContent } from '../../lib/api.js'
import { useGenerateShelf } from '../../hooks/useGenerateShelf.js'
import type { SeedMediaRef, GenerateShelfResponse } from '@iptvflix/api-contracts'
import type { MovieResponse, SeriesResponse } from '@iptvflix/api-contracts'

type SeedItem = SeedMediaRef & { title: string }

type Props = {
  open: boolean
  onClose: () => void
  onSuccess: (response: GenerateShelfResponse) => void
}

export default function GenerateShelfDialog({ open, onClose, onSuccess }: Props) {
  const [title, setTitle] = useState('')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ movies: MovieResponse[]; series: SeriesResponse[] }>({
    movies: [],
    series: [],
  })
  const [seeds, setSeeds] = useState<SeedItem[]>([])
  const [searching, setSearching] = useState(false)
  const { generate, loading, error } = useGenerateShelf()

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const result = await searchContent(query)
      setSearchResults({ movies: result.movies, series: result.series })
    } catch {
      setSearchResults({ movies: [], series: [] })
    } finally {
      setSearching(false)
    }
  }, [query])

  const addSeed = useCallback((seed: SeedItem) => {
    setSeeds((prev) => {
      if (prev.some((s) => s.mediaId === seed.mediaId) || prev.length >= 10) return prev
      return [...prev, seed]
    })
  }, [])

  const removeSeed = useCallback((mediaId: string) => {
    setSeeds((prev) => prev.filter((s) => s.mediaId !== mediaId))
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!title.trim() || seeds.length < 3) return
    try {
      const response = await generate({
        title: title.trim(),
        seedMediaIds: seeds.map(({ mediaType, mediaId }) => ({ mediaType, mediaId })),
      })
      setTitle('')
      setQuery('')
      setSearchResults({ movies: [], series: [] })
      setSeeds([])
      onSuccess(response)
      onClose()
    } catch {
      // error surfaced via `error` state from useGenerateShelf
    }
  }, [title, seeds, generate, onSuccess, onClose])

  const hasResults = searchResults.movies.length > 0 || searchResults.series.length > 0

  return (
    <Dialog open={open} onClose={onClose} title="Créer une sélection personnalisée">
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Nom de la sélection</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Thrillers psychologiques"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/30"
          />
        </div>

        {/* Seed search */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Films et séries de référence ({seeds.length}/10, 3 minimum)
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Rechercher un titre..."
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-white/30"
            />
            <Button variant="secondary" size="sm" onClick={handleSearch} loading={searching} disabled={!query.trim()}>
              Chercher
            </Button>
          </div>
        </div>

        {/* Search results */}
        {hasResults && (
          <div className="max-h-40 overflow-y-auto space-y-0.5 border border-white/10 rounded-lg p-2">
            {searchResults.movies.map((m) => {
              const selected = seeds.some((s) => s.mediaId === m.id)
              return (
                <button
                  key={m.id}
                  onClick={() => addSeed({ mediaType: 'MOVIE', mediaId: m.id, title: m.title })}
                  disabled={selected || seeds.length >= 10}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="text-xs text-gray-500 shrink-0">Film</span>
                  <span className="truncate">{m.title}{m.year ? ` (${m.year})` : ''}</span>
                  {selected && <span className="text-xs text-green-400 ml-auto shrink-0">✓</span>}
                </button>
              )
            })}
            {searchResults.series.map((s) => {
              const selected = seeds.some((seed) => seed.mediaId === s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => addSeed({ mediaType: 'SERIES', mediaId: s.id, title: s.title })}
                  disabled={selected || seeds.length >= 10}
                  className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-white/10 text-white disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <span className="text-xs text-gray-500 shrink-0">Série</span>
                  <span className="truncate">{s.title}{s.year ? ` (${s.year})` : ''}</span>
                  {selected && <span className="text-xs text-green-400 ml-auto shrink-0">✓</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Selected seeds */}
        {seeds.length > 0 && (
          <div>
            <p className="text-sm text-gray-400 mb-1">Sélectionnés</p>
            <div className="space-y-1">
              {seeds.map((seed) => (
                <div
                  key={seed.mediaId}
                  className="flex items-center justify-between text-sm bg-white/5 rounded px-3 py-1.5"
                >
                  <span className="text-white truncate">{seed.title}</span>
                  <button
                    onClick={() => removeSeed(seed.mediaId)}
                    className="text-gray-500 hover:text-white ml-3 shrink-0"
                    aria-label={`Retirer ${seed.title}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error.message}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Annuler
          </Button>
          <Button
            size="sm"
            onClick={handleGenerate}
            loading={loading}
            disabled={!title.trim() || seeds.length < 3}
          >
            Générer ({seeds.length < 3 ? `${seeds.length}/3` : seeds.length} titres)
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
