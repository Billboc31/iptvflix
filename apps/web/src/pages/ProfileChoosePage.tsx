import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.js'
import { useInteractionEvents } from '../hooks/useInteractionEvents.js'
import ProfileAvatar from '../components/ProfileAvatar.js'
import Spinner from '../components/ui/Spinner.js'

export default function ProfileChoosePage() {
  const { profiles, isLoading, selectProfile } = useProfile()
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { emit: emitEvent } = useInteractionEvents()

  async function handleSelect(profileId: string) {
    setSelecting(profileId)
    setError(null)
    try {
      await selectProfile(profileId)
      emitEvent({ eventType: 'PROFILE_SELECTED', clientType: 'web' })
      navigate('/', { replace: true })
    } catch {
      setError('Impossible de sélectionner ce profil. Veuillez réessayer.')
      setSelecting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] flex flex-col items-center justify-center px-4">
      <h1 className="text-4xl font-bold text-white mb-12 tracking-tight">Qui regarde ?</h1>

      {error && (
        <p className="text-red-400 text-sm mb-6" role="alert">{error}</p>
      )}

      {profiles.length === 0 && (
        <p className="text-gray-400 text-sm mb-8 text-center max-w-sm">
          Aucun profil n’est lié à ce compte. Créez-en un pour continuer.
        </p>
      )}

      <div className="flex flex-wrap gap-8 justify-center max-w-2xl">
        {profiles.map((profile) => {
          const isSelecting = selecting === profile.id
          return (
            <button
              key={profile.id}
              onClick={() => handleSelect(profile.id)}
              disabled={selecting !== null}
              aria-label={profile.isKids ? `${profile.name} — Profil enfant` : profile.name}
              className="flex flex-col items-center gap-3 group focus:outline-none disabled:opacity-60"
            >
              <div className="relative transition-transform group-hover:scale-110 group-focus:scale-110">
                <ProfileAvatar
                  avatarKey={profile.avatarKey}
                  name={profile.name}
                  size={96}
                  isKids={profile.isKids}
                />
                {isSelecting && (
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
                    <span className="w-6 h-6 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <span className="text-gray-300 text-sm font-medium group-hover:text-white group-focus:text-white transition-colors">
                {profile.name}
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-12 flex flex-wrap gap-3 justify-center">
        {profiles.length === 0 ? (
          <button
            onClick={() => navigate('/profiles/create')}
            className="text-sm text-white border border-white/30 hover:bg-white/10 px-5 py-2 rounded-md transition-colors"
          >
            Créer un profil
          </button>
        ) : (
          <button
            onClick={() => navigate('/profiles')}
            className="text-sm text-gray-500 hover:text-white border border-white/10 hover:border-white/30 px-5 py-2 rounded-md transition-colors"
          >
            Gérer les profils
          </button>
        )}
      </div>
    </div>
  )
}
