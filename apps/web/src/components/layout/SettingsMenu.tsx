import { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const SETTINGS_ITEMS = [
  { label: 'Sources', to: '/sources' },
  { label: 'Lecture', to: '/settings/playback' },
  { label: 'Appareils', to: '/settings/devices' },
]

export default function SettingsMenu() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  useEffect(() => {
    if (!open) return

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  // Close menu on route change
  useEffect(() => {
    setOpen(false)
  }, [location.pathname])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Paramètres"
        aria-haspopup="true"
        aria-expanded={open}
        className="text-gray-400 hover:text-white transition-colors p-1 text-sm"
      >
        ⚙️
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 bg-[#0a0a0f] border border-white/10 rounded-lg shadow-xl z-50 py-1"
        >
          {SETTINGS_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `block px-4 py-2 text-sm transition-colors ${
                  isActive ? 'text-white bg-white/10' : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}
