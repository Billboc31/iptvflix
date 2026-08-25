import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useChannels } from '../context/ChannelsContext.js'
import { useProfile } from '../context/ProfileContext.js'
import ChannelRow from '../components/channel/ChannelRow.js'
import {
  CATEGORY_DISPLAY_ORDER,
  categoryLabel,
  isCanonicalCategory,
} from '../lib/categories.js'

function preferredLangCodes(profileLangs: string[] | undefined): string[] {
  if (profileLangs?.length) {
    return profileLangs.map((l) => l.trim().toLowerCase().slice(0, 2)).filter(Boolean)
  }
  return ['fr']
}

export default function AllChannelsPage() {
  const { channels, isLoading, favoriteIds, toggleFavorite, recordHistory } = useChannels()
  const { currentProfile } = useProfile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const preferredLangs = preferredLangCodes(currentProfile?.preferredAudioLanguages)
  const primaryLang = preferredLangs[0] ?? 'fr'

  const searchQuery = searchParams.get('q') ?? ''
  const activeCategory = searchParams.get('category') ?? ''
  const langFilter = searchParams.get('lang') // 'mine' | '' (all)

  function setSearch(value: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value) next.set('q', value)
      else next.delete('q')
      return next
    }, { replace: true })
  }

  function setCategory(cat: string) {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (cat) next.set('category', cat)
      else next.delete('category')
      return next
    }, { replace: true })
  }

  function setLangFilter(mode: 'mine' | 'all') {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (mode === 'mine') {
        next.set('lang', 'mine')
      } else {
        next.delete('lang')
        next.delete('category')
      }
      return next
    }, { replace: true })
  }

  const categories = useMemo(() => {
    const present = new Set<string>()
    for (const ch of channels) {
      for (const cat of ch.categories) {
        if (isCanonicalCategory(cat)) present.add(cat)
      }
    }
    return CATEGORY_DISPLAY_ORDER.filter((c) => present.has(c))
  }, [channels])

  const filtered = useMemo(() => {
    let result = channels
    if (favoritesOnly) result = result.filter((c) => favoriteIds.has(c.id))
    if (langFilter === 'mine') {
      result = result.filter(
        (c) => c.language && preferredLangs.includes(c.language.toLowerCase()),
      )
    }
    if (activeCategory) result = result.filter((c) => c.categories.includes(activeCategory))
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter((c) => c.name.toLowerCase().includes(q))
    }
    return result
  }, [channels, favoritesOnly, activeCategory, searchQuery, favoriteIds, langFilter, preferredLangs])

  const chipClass = (active: boolean) =>
    `px-3 py-1 rounded-full text-sm border transition-colors ${
      active
        ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]'
        : 'border-white/10 text-gray-400 hover:text-white hover:border-white/20'
    }`

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Toutes les chaînes</h1>

      <div className="space-y-4 mb-6">
        <input
          type="search"
          placeholder="Rechercher une chaîne…"
          value={searchQuery}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm bg-[#111118] border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f97316]/50"
          aria-label="Rechercher une chaîne"
        />

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={chipClass(favoritesOnly)}
            aria-pressed={favoritesOnly}
          >
            ♥ Favoris
          </button>

          <button
            type="button"
            onClick={() => setLangFilter('mine')}
            className={chipClass(langFilter === 'mine')}
            aria-pressed={langFilter === 'mine'}
          >
            {primaryLang === 'fr' ? 'Ma langue (FR)' : `Ma langue (${primaryLang.toUpperCase()})`}
          </button>

          <button
            type="button"
            onClick={() => setLangFilter('all')}
            className={chipClass(langFilter !== 'mine' && !activeCategory)}
            aria-pressed={langFilter !== 'mine' && !activeCategory}
          >
            Toutes
          </button>

          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(activeCategory === cat ? '' : cat)}
              className={chipClass(activeCategory === cat)}
              aria-pressed={activeCategory === cat}
            >
              {categoryLabel(cat)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <span className="w-8 h-8 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-gray-400 text-sm max-w-sm">
            Aucune chaîne ne correspond à votre recherche.
          </p>
        </div>
      ) : (
        <div className="space-y-2" aria-label="Liste des chaînes">
          {filtered.map((channel) => (
            <ChannelRow
              key={channel.id}
              channel={channel}
              isFavorite={favoriteIds.has(channel.id)}
              onToggleFavorite={() => toggleFavorite(channel.id)}
              onRecordHistory={() => recordHistory(channel.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
