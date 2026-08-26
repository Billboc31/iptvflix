import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Accueil TV', to: '/', end: true, icon: '📺' },
  { label: 'Favoris', to: '/favorites', icon: '❤️' },
  { label: 'Guide TV', to: '/guide', icon: '📅' },
  { label: 'Chaînes', to: '/channels', icon: '📡' },
  { label: 'Recherche', to: '/search', icon: '🔍' },
]

export default function BottomNav() {
  return (
    <nav
      aria-label="Navigation Live TV"
      className="fixed bottom-0 inset-x-0 z-50 bg-[#111118] border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-16">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors border-t-2 ${
                isActive
                  ? 'border-[#f97316] text-[#f97316]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`
            }
            aria-label={item.label}
          >
            <span className="text-base" aria-hidden="true">{item.icon}</span>
            <span className="hidden sm:block text-[10px]">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
