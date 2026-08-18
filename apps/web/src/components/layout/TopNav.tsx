import { useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import SettingsMenu from './SettingsMenu.js'
import ProfileSwitcherPopover from '../ProfileSwitcherPopover.js'

const NAV_ITEMS = [
  { label: 'Accueil', to: '/', end: true },
  { label: 'Films', to: '/movies' },
  { label: 'Séries', to: '/series' },
  { label: 'Ma Liste', to: '/my-list' },
  { label: 'Nouveautés', to: '/arrivals' },
  { label: 'Lab', to: '/lab' },
]

export default function TopNav() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center h-14 px-4 md:px-8 gap-6">
        {/* Logo */}
        <NavLink to="/" className="text-xl font-bold text-[#e50914] tracking-tight shrink-0">
          IPTVFlix
        </NavLink>

        {/* Primary nav links — desktop only */}
        <nav className="hidden md:flex items-center gap-1 flex-1" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white bg-white/10'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Right section */}
        <div className="ml-auto flex items-center gap-3">
          {/* Search input — desktop */}
          <form onSubmit={handleSubmit} className="hidden md:flex items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher"
              className="w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#e50914]/50"
            />
          </form>

          {/* Search icon — mobile */}
          <button
            className="md:hidden text-gray-400 hover:text-white p-1"
            onClick={() => navigate('/search')}
            aria-label="Rechercher"
          >
            🔍
          </button>

          {/* Profile switcher */}
          <ProfileSwitcherPopover />

          {/* Settings menu */}
          <SettingsMenu />
        </div>
      </div>

      {/* Mobile nav strip */}
      <nav
        className="flex md:hidden overflow-x-auto border-t border-white/5"
        aria-label="Navigation mobile"
        style={{ scrollbarWidth: 'none' }}
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'text-white border-b-2 border-[#e50914]'
                  : 'text-gray-400 hover:text-white'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  )
}
