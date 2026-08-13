import { NavLink } from 'react-router-dom'

type NavItem = {
  label: string
  to: string
  icon: string
  disabled?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Accueil', to: '/', icon: '🏠' },
  { label: 'Films', to: '/movies', icon: '🎬' },
  { label: 'Séries', to: '/series', icon: '📺' },
  { label: 'Nouveautés', to: '/arrivals', icon: '🔔' },
  { label: 'Ma Liste', to: '/list', icon: '❤️', disabled: true },
  { label: 'Historique', to: '/history', icon: '🕐', disabled: true },
  { label: 'Recherche', to: '/search', icon: '🔍' },
  { label: 'Sources IPTV', to: '/sources', icon: '📡' },
  { label: 'Préférences lecture', to: '/settings/playback', icon: '⚙️' },
]

export default function LeftNav() {
  return (
    <nav className="fixed top-0 left-0 h-screen w-60 bg-[#111118] border-r border-white/5 flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/5">
        <span className="text-2xl font-bold text-[#e50914] tracking-tight">IPTVFlix</span>
      </div>

      {/* Nav items */}
      <div className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map((item) =>
          item.disabled ? (
            <div
              key={item.to}
              className="flex items-center gap-3 px-6 py-3 text-sm text-gray-600 opacity-40 cursor-not-allowed select-none"
              title="Fonctionnalité à venir"
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-6 py-3 text-sm transition-colors ${
                  isActive
                    ? 'text-white bg-white/10 border-r-2 border-[#e50914]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ),
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/5">
        <p className="text-xs text-gray-600">v0.1.0</p>
      </div>
    </nav>
  )
}
