import { NavLink } from 'react-router-dom'
import {
  IconHome,
  IconHeart,
  IconGuide,
  IconGrid,
  IconSearch,
} from './NavIcons.js'

const NAV_ITEMS = [
  { label: 'Accueil TV', to: '/', end: true, Icon: IconHome },
  { label: 'Favoris', to: '/favorites', Icon: IconHeart },
  { label: 'Guide TV', to: '/guide', Icon: IconGuide },
  { label: 'Chaînes', to: '/channels', Icon: IconGrid },
  { label: 'Recherche', to: '/search', Icon: IconSearch },
]

export default function BottomNav() {
  return (
    <nav
      aria-label="Navigation Live TV"
      className="fixed bottom-0 inset-x-0 z-50 bg-[#111118]/95 backdrop-blur-md border-t border-white/10"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex h-14">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex-1 flex items-center justify-center transition-colors border-t-2 ${
                isActive
                  ? 'border-[#f97316] text-[#f97316]'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`
            }
          >
            <item.Icon className="w-6 h-6" />
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
