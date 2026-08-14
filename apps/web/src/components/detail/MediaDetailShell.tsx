import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type Props = {
  onClose: () => void
  scrollY?: number
  children: ReactNode
}

export default function MediaDetailShell({ onClose, scrollY, children }: Props) {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const savedScroll = scrollY ?? 0
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', handleKeyDown)
      window.scrollTo(0, savedScroll)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center"
      role="dialog"
      aria-modal="true"
    >
      {/* Dimmed backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal panel */}
      <div
        className={[
          'relative z-10 bg-[#0a0a0f] overflow-y-auto',
          // Mobile: full-screen
          'w-full h-full',
          // Desktop: centered modal with margins
          'md:w-[min(82vw,1100px)] md:h-[90vh] md:mt-[5vh] md:rounded-xl',
        ].join(' ')}
        tabIndex={-1}
      >
        {/* Close button — always visible above content */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/70 text-white text-xl leading-none flex items-center justify-center hover:bg-black/90 transition-colors border border-white/20"
        >
          ✕
        </button>

        {children}
      </div>
    </div>,
    document.body,
  )
}
