import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ProfileResponse } from '@iptvflix/api-contracts'
import { listProfiles, selectProfile as apiSelectProfile } from '../lib/api.js'

const LAST_PROFILE_KEY = 'iptvflix_last_profile_id'

type ProfileState = {
  currentProfile: ProfileResponse | null
  profiles: ProfileResponse[]
  isLoading: boolean
  selectProfile: (profileId: string) => Promise<void>
}

const ProfileContext = createContext<ProfileState | null>(null)

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<ProfileResponse[]>([])
  const [currentProfile, setCurrentProfile] = useState<ProfileResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    async function init() {
      try {
        const list = await listProfiles()
        setProfiles(list)
        const lastId = localStorage.getItem(LAST_PROFILE_KEY)
        const last = lastId ? list.find((p) => p.id === lastId) : null
        if (last) {
          const { profile } = await apiSelectProfile(last.id)
          setCurrentProfile(profile)
        }
      } catch {
        // leave currentProfile null — ProtectedRoute redirects to /profiles/choose
      } finally {
        setIsLoading(false)
      }
    }
    init()
  }, [])

  const selectProfile = useCallback(async (profileId: string) => {
    const { profile } = await apiSelectProfile(profileId)
    localStorage.setItem(LAST_PROFILE_KEY, profileId)
    setCurrentProfile(profile)
    listProfiles().then(setProfiles).catch(() => {})
  }, [])

  return (
    <ProfileContext.Provider value={{ currentProfile, profiles, isLoading, selectProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext)
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider')
  return ctx
}
