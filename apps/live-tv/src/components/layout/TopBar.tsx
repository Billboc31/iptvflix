import { useState, type FormEvent } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.js'
import { getStoredAuthToken } from '../../lib/api.js'

const VOD_URL = import.meta.env.VITE_VOD_URL ?? 'http://localhost:5173'

const NAV_ITEMS = [
  { label: 'Accueil', to: '/', end: true },
  { label: 'Favoris', to: '/favorites' },
  { label: 'Guide', to: '/guide' },
  { label: 'Chaînes', to: '/channels' },
  { label: 'Récents', to: '/recent' },
]

export default function TopBar() {
  const { username, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  function handleVodSwitch() {
    const token = getStoredAuthToken()
    const url = token ? `${VOD_URL}?token=${encodeURIComponent(token)}` : VOD_URL
    window.location.href = url
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center h-14 px-4 md:px-6 gap-4 md:gap-6">
        <NavLink to="/" className="text-xl font-bold text-[#f97316] tracking-tight shrink-0">
          IPTVFlix
        </NavLink>

        <div
          className="flex items-center gap-1 bg-white/5 rounded-lg p-1 shrink-0"
          role="tablist"
          aria-label="Mode de visionnage"
        >
          <button
            type="button"
            role="tab"
            aria-selected={false}
            onClick={handleVodSwitch}
            className="px-3 py-1 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            VOD
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={true}
            className="px-3 py-1 rounded-md text-sm font-medium bg-[#f97316] text-white cursor-default"
          >
            TV
          </button>
        </div>

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

        <div className="ml-auto flex items-center gap-3">
          <form onSubmit={handleSubmit} className="hidden md:flex items-center">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher…"
              aria-label="Rechercher"
              className="w-40 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#f97316]/50"
            />
          </form>

          <button
            type="button"
            className="md:hidden text-gray-400 hover:text-white p-1"
            onClick={() => navigate('/search')}
            aria-label="Rechercher"
          >
            🔍
          </button>

          {username && (
            <span className="hidden md:block text-sm text-gray-400">{username}</span>
          )}
          <button
            type="button"
            onClick={logout}
            className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded"
            aria-label="Se déconnecter"
          >
            ⏻
          </button>
        </div>
      </div>

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
                  ? 'text-white border-b-2 border-[#f97316]'
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
