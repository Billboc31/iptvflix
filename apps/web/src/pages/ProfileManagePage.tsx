import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../context/ProfileContext.js'
import { deleteProfile } from '../lib/api.js'
import { ApiError } from '../lib/api.js'
import ProfileAvatar from '../components/ProfileAvatar.js'
import Button from '../components/ui/Button.js'
import Spinner from '../components/ui/Spinner.js'

const MAX_PROFILES = 5

export default function ProfileManagePage() {
  const { profiles, currentProfile, isLoading, refreshProfiles } = useProfile()
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleDelete(profileId: string, name: string) {
    if (!window.confirm(`Supprimer le profil « ${name} » ? Cette action est irréversible.`)) return
    setDeleting(profileId)
    setDeleteError(null)
    try {
      await deleteProfile(profileId)
      await refreshProfiles()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteError(err.message)
      } else {
        setDeleteError('Impossible de supprimer ce profil.')
      }
    } finally {
      setDeleting(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Gérer les profils</h1>
        <Button
          variant="secondary"
          onClick={() => navigate('/profiles/create')}
          disabled={profiles.length >= MAX_PROFILES}
          title={profiles.length >= MAX_PROFILES ? `Limite de ${MAX_PROFILES} profils atteinte` : undefined}
        >
          + Ajouter
        </Button>
      </div>

      {profiles.length >= MAX_PROFILES && (
        <p className="text-sm text-gray-400 mb-4">
          Vous avez atteint la limite de {MAX_PROFILES} profils.
        </p>
      )}

      {deleteError && (
        <p className="text-red-400 text-sm mb-4 bg-red-400/10 border border-red-400/20 rounded-lg px-4 py-3" role="alert">
          {deleteError}
        </p>
      )}

      <ul className="space-y-3">
        {profiles.map((profile) => {
          const isCurrent = profile.id === currentProfile?.id
          const isDeleting = deleting === profile.id
          return (
            <li
              key={profile.id}
              className="flex items-center gap-4 p-4 bg-white/5 border border-white/10 rounded-xl"
            >
              <ProfileAvatar
                avatarKey={profile.avatarKey}
                name={profile.name}
                size={48}
                isActive={isCurrent}
                isKids={profile.isKids}
              />
              <div className="flex-1 min-w-0">
                <p className="text-white font-medium truncate">{profile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5 flex gap-2">
                  {isCurrent && <span className="text-[#e50914]">Profil actif</span>}
                  {profile.isKids && <span className="text-blue-400">Kids</span>}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigate(`/profiles/${profile.id}/edit`)}
                  aria-label={`Modifier ${profile.name}`}
                  className="text-gray-400 hover:text-white transition-colors px-2 py-1 text-sm"
                >
                  Modifier
                </button>
                <button
                  onClick={() => handleDelete(profile.id, profile.name)}
                  disabled={isDeleting || profiles.length <= 1}
                  aria-label={`Supprimer ${profile.name}`}
                  className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-30 px-2 py-1 text-sm"
                >
                  {isDeleting ? '…' : 'Supprimer'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
