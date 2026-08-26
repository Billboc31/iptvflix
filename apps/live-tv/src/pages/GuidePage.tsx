import { useMemo } from 'react'
import type { GuideChannelResponse } from '@iptvflix/api-contracts'
import { useNavigate } from 'react-router-dom'
import { useChannels } from '../context/ChannelsContext.js'
import { getGuideChannels } from '../lib/api.js'
import ChannelLogo from '../components/channel/ChannelLogo.js'
import EpgProgress from '../components/channel/EpgProgress.js'
import { useEffect, useState } from 'react'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function GuideRow({ channel, onWatch }: { channel: GuideChannelResponse; onWatch: (id: string) => void }) {
  const now = channel.epg?.now
  const next = channel.epg?.next

  return (
    <div className="grid grid-cols-[minmax(0,180px)_1fr_1fr] gap-3 items-center px-4 py-3 bg-[#111118] border border-white/5 rounded-xl hover:border-[#f97316]/20 transition-colors">
      <button
        type="button"
        className="flex items-center gap-2 text-left min-w-0"
        onClick={() => onWatch(channel.id)}
      >
        <ChannelLogo logoUrl={channel.logoUrl} name={channel.name} size="sm" />
        <span className="text-white text-sm font-medium truncate">{channel.name}</span>
      </button>

      <div className="min-w-0">
        {now ? (
          <div className="space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="text-gray-300 text-xs truncate">{now.title}</span>
              <span className="shrink-0 text-gray-500 text-[10px]">
                {formatTime(now.startTime)}–{formatTime(now.endTime)}
              </span>
            </div>
            <EpgProgress startTime={now.startTime} endTime={now.endTime} />
          </div>
        ) : (
          <span className="text-gray-600 text-xs">Programme indisponible</span>
        )}
      </div>

      <div className="min-w-0 hidden md:block">
        {next ? (
          <p className="text-gray-500 text-xs truncate">
            {formatTime(next.startTime)} — {next.title}
          </p>
        ) : channel.programs[1] ? (
          <p className="text-gray-500 text-xs truncate">
            {formatTime(channel.programs[1]!.startTime)} — {channel.programs[1]!.title}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export default function GuidePage() {
  const navigate = useNavigate()
  const { country } = useChannels()
  const [guide, setGuide] = useState<GuideChannelResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getGuideChannels({ country: country, hours: 6 })
      .then((rows) => {
        if (!cancelled) setGuide(rows)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le guide TV')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [country])

  const withEpg = useMemo(() => guide.filter((c) => c.epg?.now || c.programs.length > 0), [guide])

  return (
    <div className="p-6 md:p-8">
      <h1 className="text-2xl font-bold text-white mb-2">Guide TV</h1>
      <p className="text-gray-500 text-sm mb-6">
        Programmes en direct et à venir — source xmltvfr.fr
      </p>

      {loading && (
        <div className="flex justify-center py-16">
          <span className="w-10 h-10 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!loading && !error && (
        <div className="space-y-2">
          <div className="hidden md:grid grid-cols-[minmax(0,180px)_1fr_1fr] gap-3 px-4 text-[10px] uppercase tracking-wide text-gray-500">
            <span>Chaîne</span>
            <span>En ce moment</span>
            <span>Ensuite</span>
          </div>
          {withEpg.length === 0 ? (
            <p className="text-gray-500 text-sm py-8 text-center">
              Aucun programme disponible pour le moment.
            </p>
          ) : (
            withEpg.map((ch) => (
              <GuideRow key={ch.id} channel={ch} onWatch={(id) => navigate(`/watch/${id}`)} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
