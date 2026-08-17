import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

type KeyboardHandlers = {
  togglePlay: () => void
  seek: (seconds: number) => void
  toggleMute: () => void
  toggleFullscreen: () => void
}

export function usePlayerKeyboard(
  videoRef: RefObject<HTMLVideoElement | null>,
  handlers: KeyboardHandlers,
): void {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Skip shortcuts when the user is typing in an editable field
      const target = e.target
      if (target instanceof Element) {
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.getAttribute('contenteditable') === 'true'
        ) return
      }

      const video = videoRef.current
      if (!video) return

      switch (e.key) {
        case ' ':
        case 'k':
        case 'K':
          e.preventDefault()
          handlersRef.current.togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          handlersRef.current.seek(Math.max(0, video.currentTime - 10))
          break
        case 'ArrowRight': {
          e.preventDefault()
          const dur = isFinite(video.duration) ? video.duration : Infinity
          handlersRef.current.seek(Math.min(dur, video.currentTime + 10))
          break
        }
        case 'm':
        case 'M':
          e.preventDefault()
          handlersRef.current.toggleMute()
          break
        case 'f':
        case 'F':
          e.preventDefault()
          handlersRef.current.toggleFullscreen()
          break
        case 'Escape':
          if (document.fullscreenElement) {
            e.preventDefault()
            document.exitFullscreen().catch(() => undefined)
          }
          break
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [videoRef])
}
