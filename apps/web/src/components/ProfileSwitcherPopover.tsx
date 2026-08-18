import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.js'
import { useAuth } from '../context/AuthContext.js'
import ProfileAvatar from './ProfileAvatar.js'

export default function ProfileSwitcherPopover() {
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { currentProfile, profiles, selectProfile } = useProfile()
  const { logout } = useAuth()
  const navigate = useNavigate()

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

  async function handleSelect(profileId: string) {
    if (profileId === currentProfile?.id) { setOpen(false); return }
    setSwitching(profileId)
    try {
      await selectProfile(profileId)
      setOpen(false)
      navigate('/', { replace: true })
    } catch {
      // error handled by context — stay on current profile
    } finally {
      setSwitching(null)
    }
  }

  async function handleLogout() {
    setOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  if (!currentProfile) return null

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Changer de profil"
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <ProfileAvatar
          avatarKey={currentProfile.avatarKey}
          name={currentProfile.name}
          size={32}
          isActive={false}
          isKids={currentProfile.isKids}
        />
        <span className="hidden sm:block text-sm text-gray-300 max-w-[100px] truncate">
          {currentProfile.name}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Profils"
          className="absolute right-0 mt-2 w-56 bg-[#111118] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden"
        >
          {profiles.map((profile) => {
            const isCurrent = profile.id === currentProfile.id
            const isSwitch = switching === profile.id
            return (
              <button
                key={profile.id}
                role="menuitem"
                onClick={() => handleSelect(profile.id)}
                disabled={isSwitch}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left ${
                  isCurrent
                    ? 'text-white bg-white/10'
                    : 'text-gray-300 hover:text-white hover:bg-white/5'
                }`}
              >
                <ProfileAvatar
                  avatarKey={profile.avatarKey}
                  name={profile.name}
                  size={32}
                  isActive={isCurrent}
                  isKids={profile.isKids}
                />
                <span className="flex-1 truncate">{profile.name}</span>
                {isCurrent && (
                  <span className="text-[#e50914] text-xs">✓</span>
                )}
                {isSwitch && (
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                )}
              </button>
            )
          })}

          <div className="border-t border-white/10 mt-1 pt-1">
            <button
              role="menuitem"
              onClick={() => { setOpen(false); navigate('/profiles') }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors"
            >
              Gérer les profils
            </button>
            <button
              role="menuitem"
              onClick={handleLogout}
              className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors"
            >
              Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
