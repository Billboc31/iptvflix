import { useAuth } from '../../context/AuthContext.js'
import { getStoredAuthToken } from '../../lib/api.js'

const VOD_URL = import.meta.env.VITE_VOD_URL ?? 'http://localhost:5173'

export default function TopBar() {
  const { username, logout } = useAuth()

  function handleVodSwitch() {
    const token = getStoredAuthToken()
    const url = token ? `${VOD_URL}?token=${encodeURIComponent(token)}` : VOD_URL
    window.location.href = url
  }

  return (
    <header className="sticky top-0 z-40 bg-[#0a0a0f]/90 backdrop-blur-md border-b border-white/5">
      <div className="flex items-center h-14 px-4 md:px-6 gap-4">
        <span className="text-xl font-bold text-[#f97316] tracking-tight shrink-0">
          IPTVFlix
        </span>

        {/* VOD / TV mode toggle */}
        <div
          className="flex items-center gap-1 bg-white/5 rounded-lg p-1"
          role="tablist"
          aria-label="Mode de visionnage"
        >
          <button
            role="tab"
            aria-selected={false}
            onClick={handleVodSwitch}
            className="px-3 py-1 rounded-md text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            VOD
          </button>
          <button
            role="tab"
            aria-selected={true}
            className="px-3 py-1 rounded-md text-sm font-medium bg-[#f97316] text-white cursor-default"
          >
            TV
          </button>
        </div>

        <div className="ml-auto flex items-center gap-3">
          {username && (
            <span className="hidden md:block text-sm text-gray-400">{username}</span>
          )}
          <button
            onClick={logout}
            className="text-sm text-gray-400 hover:text-white transition-colors px-2 py-1 rounded"
            aria-label="Se déconnecter"
          >
            ⏻
          </button>
        </div>
      </div>
    </header>
  )
}
