import { useNavigate } from 'react-router-dom'
import type { ChannelResponse } from '@iptvflix/api-contracts'

type Props = {
  channels: ChannelResponse[]
}

export default function CategoryShortcuts({ channels }: Props) {
  const navigate = useNavigate()

  const counts = new Map<string, number>()
  for (const ch of channels) {
    for (const cat of ch.categories) {
      counts.set(cat, (counts.get(cat) ?? 0) + 1)
    }
  }

  const categories = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])

  if (categories.length === 0) return null

  return (
    <section aria-label="Catégories">
      <h2 className="text-lg font-semibold text-white mb-4">Catégories</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {categories.map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => navigate(`/channels?category=${encodeURIComponent(cat)}`)}
            className="bg-[#111118] border border-white/5 rounded-xl p-4 text-left hover:border-[#f97316]/40 hover:bg-[#f97316]/5 transition-colors group"
          >
            <p className="text-white text-sm font-medium truncate group-hover:text-[#f97316] transition-colors">
              {cat}
            </p>
            <p className="text-gray-500 text-xs mt-1">{count} chaîne{count > 1 ? 's' : ''}</p>
          </button>
        ))}
      </div>
    </section>
  )
}
