import type { ChannelResponse } from '@iptvflix/api-contracts'
import { useChannels } from '../context/ChannelsContext.js'
import { useProfile } from '../context/ProfileContext.js'
import LiveRail from '../components/channel/LiveRail.js'
import CategoryShortcuts from '../components/channel/CategoryShortcuts.js'
import { CATEGORY_DISPLAY_ORDER, categoryLabel } from '../lib/categories.js'

const RAIL_LIMIT = 24

function historyChannels(
  channels: ChannelResponse[],
  history: { channelId: string }[],
): ChannelResponse[] {
  const byId = new Map(channels.map((c) => [c.id, c]))
  return history
    .map((h) => byId.get(h.channelId))
    .filter((c): c is ChannelResponse => c !== undefined)
}

function preferredLangCodes(profileLangs: string[] | undefined): string[] {
  if (profileLangs?.length) {
    return profileLangs.map((l) => l.trim().toLowerCase().slice(0, 2)).filter(Boolean)
  }
  return ['fr']
}

export default function HomePage() {
  const { channels, isLoading, error, favoriteIds, toggleFavorite, history, recordHistory } = useChannels()
  const { currentProfile } = useProfile()

  const preferredLangs = preferredLangCodes(currentProfile?.preferredAudioLanguages)
  const recentChannels = historyChannels(channels, history)
  const favoriteChannels = channels.filter((c) => favoriteIds.has(c.id)).slice(0, RAIL_LIMIT)

  const languageChannels = channels
    .filter((c) => c.language && preferredLangs.includes(c.language.toLowerCase()))
    .slice(0, RAIL_LIMIT)

  const categoryRails = CATEGORY_DISPLAY_ORDER
    .filter((cat) => cat !== 'other')
    .map((cat) => ({
      id: cat,
      title: categoryLabel(cat),
      channels: channels
        .filter((c) => c.categories.includes(cat))
        .slice(0, RAIL_LIMIT),
    }))
    .filter((rail) => rail.channels.length > 0)

  if (error) {
    return (
      <div className="p-8 text-red-400 text-sm" role="alert">{error}</div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-10">
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
        title={preferredLangs[0] === 'fr' ? 'Chaînes françaises' : `Ma langue (${preferredLangs[0]?.toUpperCase()})`}
        channels={languageChannels}
        isLoading={isLoading}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onRecordHistory={recordHistory}
      />

      {!isLoading && channels.length > 0 && (
        <CategoryShortcuts channels={channels} />
      )}

      {categoryRails.map((rail) => (
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
            Aucune chaîne disponible pour le moment.
          </p>
        </div>
      )}
    </div>
  )
}
