import { NavLink } from 'react-router-dom'

type BottomNavItem = {
  label: string
  to: string
  icon: string
  end?: boolean
}

const NAV_ITEMS: BottomNavItem[] = [
  { label: 'Accueil', to: '/', icon: '🏠', end: true },
  { label: 'Recherche', to: '/search', icon: '🔍' },
  { label: 'Ma Liste', to: '/library', icon: '❤️' },
  { label: 'Activité', to: '/activity', icon: '🕐' },
  { label: 'Profil', to: '/profile', icon: '👤' },
]

export default function BottomNav() {
  return (
    <nav
      className="block md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#111118] border-t border-white/5"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Navigation principale"
    >
      <div className="flex items-stretch justify-around">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[48px] py-2 text-xs font-medium transition-colors ${
                isActive ? 'text-[#e50914]' : 'text-gray-400'
              }`
            }
          >
            <span className="text-lg leading-none" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
