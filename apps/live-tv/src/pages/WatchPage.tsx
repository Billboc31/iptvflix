import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { resolveChannelPlayback, recordHistory, ApiError } from '../lib/api.js'
import { resolveMediaUrl } from '../lib/media-url.js'
import ChannelLogo from '../components/channel/ChannelLogo.js'
import { useChannels } from '../context/ChannelsContext.js'

function isHlsUrl(url: string, ext: string): boolean {
  const e = ext.toLowerCase().replace(/^\./, '')
  return e === 'm3u8' || e === 'm3u' || url.includes('.m3u8')
}

export default function WatchPage() {
  const { channelId } = useParams<{ channelId: string }>()
  const navigate = useNavigate()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<import('hls.js').default | null>(null)
  const { channels } = useChannels()

  const channel = channels.find((c) => c.id === channelId)

  const [status, setStatus] = useState<'loading' | 'playing' | 'error'>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!channelId) return

    let cancelled = false

    async function startPlayback() {
      setStatus('loading')
      setError(null)

      try {
        const session = await resolveChannelPlayback(channelId!)
        if (cancelled) return

        const url = resolveMediaUrl(session.gatewayUrl)
        const video = videoRef.current
        if (!video) return

        if (hlsRef.current) {
          hlsRef.current.destroy()
          hlsRef.current = null
        }

        const useHls =
          session.deliveryMode !== 'DIRECT' || isHlsUrl(url, session.containerExtension)

        if (useHls) {
          const { default: Hls } = await import('hls.js')
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true })
            hlsRef.current = hls
            hls.loadSource(url)
            hls.attachMedia(video)
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
              void video.play().catch(() => {})
            })
            hls.on(Hls.Events.ERROR, (_event, data) => {
              if (data.fatal) {
                setError('Erreur de lecture du flux')
                setStatus('error')
              }
            })
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url
            await video.play().catch(() => {})
          } else {
            throw new Error('HLS non supporté')
          }
        } else {
          video.src = url
          await video.play().catch(() => {})
        }

        void recordHistory(channelId!).catch(() => {})
        setStatus('playing')
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setError('Flux indisponible')
        } else {
          setError('Impossible de démarrer la lecture')
        }
        setStatus('error')
      }
    }

    void startPlayback()

    return () => {
      cancelled = true
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [channelId])

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      <header className="flex items-center gap-4 px-4 py-3 bg-[#0a0a0f]/90 border-b border-white/10 z-10">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white text-sm"
        >
          ← Retour
        </button>
        {channel && (
          <div className="flex items-center gap-2 min-w-0">
            <ChannelLogo logoUrl={channel.logoUrl} name={channel.name} size="sm" />
            <span className="text-white text-sm font-medium truncate">{channel.name}</span>
            <span className="shrink-0 text-[10px] font-bold bg-[#f97316] text-white px-1.5 py-0.5 rounded">
              LIVE
            </span>
          </div>
        )}
      </header>

      <div className="flex-1 relative flex items-center justify-center">
        {status === 'loading' && (
          <span className="absolute z-10 w-12 h-12 border-4 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
        )}

        {status === 'error' && error && (
          <div className="absolute z-10 text-center px-6">
            <p className="text-red-400 text-sm mb-4">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="px-4 py-2 rounded-lg bg-[#f97316] text-white text-sm"
            >
              Retour à l&apos;accueil
            </button>
          </div>
        )}

        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          controls
          autoPlay
          playsInline
        />
      </div>
    </div>
  )
}
