import { useEffect, useRef, useState } from 'react'

type PreviewPlayerProps = {
  trailerKey: string
  active: boolean
  muted?: boolean
}

export default function PreviewPlayer({ trailerKey, active, muted = true }: PreviewPlayerProps) {
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setLoaded(false)
    setFailed(false)
  }, [trailerKey])

  useEffect(() => {
    if (!active || !iframeRef.current?.contentWindow) return
    iframeRef.current.contentWindow.postMessage(
      JSON.stringify({ event: 'command', func: muted ? 'mute' : 'unMute', args: '' }),
      '*',
    )
  }, [muted, active, loaded])

  if (!active) return null

  const src = `https://www.youtube-nocookie.com/embed/${trailerKey}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${trailerKey}&enablejsapi=1`

  return (
    <iframe
      ref={iframeRef}
      key={trailerKey}
      src={src}
      tabIndex={-1}
      allow="autoplay; encrypted-media"
      title="Preview"
      data-testid="preview-iframe"
      className="absolute inset-0 w-full h-full border-0 transition-opacity duration-500"
      style={{
        opacity: loaded && !failed ? 1 : 0,
        visibility: failed ? 'hidden' : 'visible',
      }}
      onLoad={() => setLoaded(true)}
      onError={() => setFailed(true)}
    />
  )
}
