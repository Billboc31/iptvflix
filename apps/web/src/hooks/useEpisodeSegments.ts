import { useEffect, useState } from 'react'
import type { EpisodeSegmentItem, ProfilePreferences } from '@iptvflix/api-contracts'
import { getEpisodeSegments, getMovieSegments, getProfile, updateProfilePreferences } from '../lib/api.js'

export function useEpisodeSegments(episodeId: string | null, durationSeconds: number | null, sourceKey: string | null, mediaType: 'movie' | 'episode' = 'episode') {
  const [state, setState] = useState<{ key: string; segments: EpisodeSegmentItem[] }>({ key: '', segments: [] })
  const key = `${mediaType}:${episodeId}:${sourceKey}:${durationSeconds}`
  useEffect(() => {
    if (!episodeId) return
    let cancelled = false
    const fetchSegments = mediaType === 'movie' ? getMovieSegments : getEpisodeSegments
    fetchSegments(episodeId, durationSeconds ?? undefined).then((response) => {
      if (!cancelled) setState({ key, segments: response.segments })
    }).catch(() => { if (!cancelled) setState({ key, segments: [] }) })
    return () => { cancelled = true }
  }, [episodeId, key, durationSeconds, mediaType])
  return state.key === key ? state.segments : []
}

export function usePlaybackPreferences(episodeId: string | null) {
  const [preferences, setPreferences] = useState<Partial<ProfilePreferences>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!episodeId) return
    let cancelled = false
    getProfile().then((p) => { if (!cancelled) setPreferences(p.preferences) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [episodeId])
  async function toggleNeverStop() {
    setSaving(true)
    setError(null)
    try {
      const result = await updateProfilePreferences({ neverStopMode: !preferences.neverStopMode })
      setPreferences(result.preferences)
    } catch { setError('Impossible d’enregistrer le mode Never Stop.') }
    finally { setSaving(false) }
  }
  return { preferences, toggleNeverStop, saving, preferenceError: error }
}
