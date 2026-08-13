import { useRef, type ReactNode } from 'react'

type HorizontalRowProps = {
  title: string
  children: ReactNode
}

export default function HorizontalRow({ title, children }: HorizontalRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  const scroll = (dir: 'left' | 'right') => {
    rowRef.current?.scrollBy({ left: dir === 'left' ? -400 : 400, behavior: 'smooth' })
  }

  return (
    <section className="mb-8 px-4 md:px-8">
      <h2 className="text-lg font-semibold text-white mb-3 px-1">{title}</h2>
      <div className="relative group">
        {/* Left arrow — desktop only */}
        <button
          onClick={() => scroll('left')}
          aria-label="Défiler à gauche"
          className="hidden md:flex absolute left-0 top-0 bottom-6 z-10 w-10 items-center justify-center opacity-0 group-hover:opacity-100 bg-gradient-to-r from-[#0a0a0f] to-transparent transition-opacity"
        >
          <span className="text-white text-lg">‹</span>
        </button>

        {/* Scrollable row */}
        <div
          ref={rowRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
        >
          {children}
        </div>

        {/* Right arrow — desktop only */}
        <button
          onClick={() => scroll('right')}
          aria-label="Défiler à droite"
          className="hidden md:flex absolute right-0 top-0 bottom-6 z-10 w-10 items-center justify-center opacity-0 group-hover:opacity-100 bg-gradient-to-l from-[#0a0a0f] to-transparent transition-opacity"
        >
          <span className="text-white text-lg">›</span>
        </button>
      </div>
    </section>
  )
}
