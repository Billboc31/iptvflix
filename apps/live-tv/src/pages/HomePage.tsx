import type { ChannelResponse } from '@iptvflix/api-contracts'
import { useChannels } from '../context/ChannelsContext.js'
import LiveRail from '../components/channel/LiveRail.js'
import CategoryShortcuts from '../components/channel/CategoryShortcuts.js'
import { CATEGORY_DISPLAY_ORDER, categoryLabel } from '../lib/categories.js'
import { countryLabel } from '../lib/countries.js'

const RAIL_LIMIT = 36

function historyChannels(
  channels: ChannelResponse[],
  history: { channelId: string }[],
): ChannelResponse[] {
  const byId = new Map(channels.map((c) => [c.id, c]))
  return history
    .map((h) => byId.get(h.channelId))
    .filter((c): c is ChannelResponse => c !== undefined)
}

export default function HomePage() {
  const {
    channels,
    isLoading,
    error,
    catalog,
    country,
    setCatalog,
    favoriteIds,
    toggleFavorite,
    history,
    recordHistory,
  } = useChannels()

  const recentChannels = historyChannels(channels, history)
  const favoriteChannels = channels.filter((c) => favoriteIds.has(c.id)).slice(0, RAIL_LIMIT)
  // Main country rail: show the full curated list (~150 FR), not a capped preview.
  const countryChannels = channels

  const categoryRails = CATEGORY_DISPLAY_ORDER
    .filter((cat) => cat !== 'other')
    .map((cat) => ({
      id: cat,
      title: categoryLabel(cat),
      channels: channels.filter((c) => c.categories.includes(cat)).slice(0, RAIL_LIMIT),
    }))
    .filter((rail) => rail.channels.length > 0)

  if (error) {
    return (
      <div className="p-8 text-red-400 text-sm" role="alert">{error}</div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-10">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-white mr-auto">
          {catalog === 'curated' ? countryLabel(country) : 'Catalogue IPTV'}
        </h1>
        <button
          type="button"
          onClick={() => setCatalog('curated')}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            catalog === 'curated'
              ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]'
              : 'border-white/10 text-gray-400 hover:text-white'
          }`}
          aria-pressed={catalog === 'curated'}
        >
          {countryLabel(country)}
        </button>
        <button
          type="button"
          onClick={() => setCatalog('all')}
          className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
            catalog === 'all'
              ? 'border-[#f97316] bg-[#f97316]/10 text-[#f97316]'
              : 'border-white/10 text-gray-400 hover:text-white'
          }`}
          aria-pressed={catalog === 'all'}
        >
          Catalogue brut
        </button>
      </div>

      <LiveRail
        title="Favoris"
        channels={favoriteChannels}
        isLoading={isLoading}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onRecordHistory={recordHistory}
      />

      {recentChannels.length > 0 && (
        <LiveRail
          title="Récemment regardées"
          channels={recentChannels.slice(0, RAIL_LIMIT)}
          isLoading={false}
          favoriteIds={favoriteIds}
          onToggleFavorite={toggleFavorite}
          onRecordHistory={recordHistory}
        />
      )}

      <LiveRail
        title={catalog === 'curated' ? `Chaînes ${countryLabel(country)}` : 'Toutes les chaînes'}
        channels={countryChannels}
        isLoading={isLoading}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onRecordHistory={recordHistory}
        seeAllTo="/channels"
      />

      {!isLoading && channels.length > 0 && catalog === 'curated' && (
        <CategoryShortcuts channels={channels} />
      )}

      {catalog === 'curated' &&
        categoryRails.map((rail) => (
          <LiveRail
            key={rail.id}
            title={rail.title}
            channels={rail.channels}
            isLoading={false}
            favoriteIds={favoriteIds}
            onToggleFavorite={toggleFavorite}
            onRecordHistory={recordHistory}
          />
        ))}

      {!isLoading && channels.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <p className="text-4xl mb-4">📡</p>
          <p className="text-gray-400 text-sm max-w-sm">
            {catalog === 'curated'
              ? 'Aucune chaîne matchée pour ce pays. Essayez le catalogue brut ou attendez le prochain sync.'
              : 'Aucune chaîne disponible pour le moment.'}
          </p>
        </div>
      )}
    </div>
  )
}
