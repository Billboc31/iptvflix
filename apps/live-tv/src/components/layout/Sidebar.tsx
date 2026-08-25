import { NavLink } from 'react-router-dom'
import { useChannels } from '../../context/ChannelsContext.js'

const NAV_ITEMS = [
  { label: 'Accueil TV', to: '/', end: true, icon: '📺' },
  { label: 'Favoris', to: '/favorites', icon: '❤️' },
  { label: 'Récemment regardées', to: '/recent', icon: '🕐' },
  { label: 'Guide TV', to: '/guide', icon: '📅' },
  { label: 'Toutes les chaînes', to: '/channels', icon: '📡' },
]

export default function Sidebar() {
  const { channels } = useChannels()

  const categories = Array.from(
    new Set(channels.flatMap((c) => c.categories)),
  ).sort()

  return (
    <aside className="w-16 md:w-56 shrink-0 flex flex-col bg-[#111118] border-r border-white/5 min-h-screen overflow-y-auto">
      <div className="px-3 md:px-4 py-5 border-b border-white/5">
        <span className="hidden md:block text-lg font-bold text-[#f97316] tracking-tight">
          IPTVFlix
        </span>
        <span className="md:hidden text-lg font-bold text-[#f97316]">IV</span>
      </div>

      <nav className="flex flex-col gap-1 p-2 flex-1" aria-label="Navigation Live TV">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#f97316]/15 text-[#f97316]'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`
            }
            aria-label={item.label}
          >
            <span className="shrink-0 text-base">{item.icon}</span>
            <span className="hidden md:block truncate">{item.label}</span>
          </NavLink>
        ))}

        {categories.length > 0 && (
          <div className="hidden md:block mt-4">
            <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600">
              Catégories
            </p>
            {categories.map((cat) => (
              <NavLink
                key={cat}
                to={`/channels?category=${encodeURIComponent(cat)}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#f97316]/10 text-[#f97316]'
                      : 'text-gray-500 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <span className="truncate">{cat}</span>
              </NavLink>
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}
