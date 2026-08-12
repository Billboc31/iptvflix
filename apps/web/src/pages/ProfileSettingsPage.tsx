import { useEffect, useState } from 'react'
import type { ProfilePreferences, SourceResponse } from '@iptvflix/api-contracts'
import { getProfile, listSources, updateProfilePreferences } from '../lib/api.js'
import Button from '../components/ui/Button.js'
import Spinner from '../components/ui/Spinner.js'

const QUALITY_OPTIONS = [
  { value: '', label: 'Aucune limite' },
  { value: '4K', label: '4K' },
  { value: '1080p', label: '1080p' },
  { value: '720p', label: '720p' },
  { value: '480p', label: '480p' },
]

function LanguageListInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [input, setInput] = useState('')

  function add() {
    const code = input.trim().toLowerCase()
    if (!code || value.includes(code)) return
    onChange([...value, code])
    setInput('')
  }

  function remove(code: string) {
    onChange(value.filter((v) => v !== code))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...value]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  function moveDown(idx: number) {
    if (idx === value.length - 1) return
    const next = [...value]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <ol className="mb-2 space-y-1">
        {value.map((code, idx) => (
          <li key={code} className="flex items-center gap-2 bg-white/5 rounded px-3 py-1.5 text-sm text-white">
            <span className="w-6 text-gray-500 text-xs text-right">{idx + 1}.</span>
            <span className="flex-1 font-mono">{code}</span>
            <button
              type="button"
              onClick={() => moveUp(idx)}
              disabled={idx === 0}
              className="text-gray-400 hover:text-white disabled:opacity-30 px-1"
              aria-label={`Monter ${code}`}
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveDown(idx)}
              disabled={idx === value.length - 1}
              className="text-gray-400 hover:text-white disabled:opacity-30 px-1"
              aria-label={`Descendre ${code}`}
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => remove(code)}
              className="text-gray-400 hover:text-red-400 px-1"
              aria-label={`Supprimer ${code}`}
            >
              ✕
            </button>
          </li>
        ))}
        {value.length === 0 && (
          <li className="text-gray-600 text-sm italic">Aucune langue configurée</li>
        )}
      </ol>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="ex: en, fr, de"
          className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-white/30"
        />
        <Button type="button" variant="ghost" onClick={add}>
          Ajouter
        </Button>
      </div>
    </div>
  )
}

function SourcePriorityInput({
  sources,
  value,
  onChange,
}: {
  sources: SourceResponse[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const [selected, setSelected] = useState('')

  const displayedIds = value.filter((id) => sources.some((s) => s.id === id))
  const available = sources.filter((s) => !value.includes(s.id))

  function add() {
    if (!selected) return
    onChange([...value, selected])
    setSelected('')
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  function moveUp(idx: number) {
    if (idx === 0) return
    const next = [...displayedIds]
    ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
    onChange(next)
  }

  function moveDown(idx: number) {
    if (idx === displayedIds.length - 1) return
    const next = [...displayedIds]
    ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
    onChange(next)
  }

  return (
    <div className="mb-6">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Sources préférées (ordre de priorité)
      </label>
      <ol className="mb-2 space-y-1">
        {displayedIds.map((id, idx) => {
          const source = sources.find((s) => s.id === id)!
          return (
            <li key={id} className="flex items-center gap-2 bg-white/5 rounded px-3 py-1.5 text-sm text-white">
              <span className="w-6 text-gray-500 text-xs text-right">{idx + 1}.</span>
              <span className="flex-1">{source.name}</span>
              <button
                type="button"
                onClick={() => moveUp(idx)}
                disabled={idx === 0}
                className="text-gray-400 hover:text-white disabled:opacity-30 px-1"
                aria-label={`Monter ${source.name}`}
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => moveDown(idx)}
                disabled={idx === displayedIds.length - 1}
                className="text-gray-400 hover:text-white disabled:opacity-30 px-1"
                aria-label={`Descendre ${source.name}`}
              >
                ▼
              </button>
              <button
                type="button"
                onClick={() => remove(id)}
                className="text-gray-400 hover:text-red-400 px-1"
                aria-label={`Supprimer ${source.name}`}
              >
                ✕
              </button>
            </li>
          )
        })}
        {displayedIds.length === 0 && (
          <li className="text-gray-600 text-sm italic">Aucune source prioritaire configurée</li>
        )}
      </ol>
      {available.length > 0 && (
        <div className="flex gap-2">
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
          >
            <option value="" className="bg-[#111118]">Choisir une source…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id} className="bg-[#111118]">
                {s.name}
              </option>
            ))}
          </select>
          <Button type="button" variant="ghost" onClick={add}>
            Ajouter
          </Button>
        </div>
      )}
    </div>
  )
}

export default function ProfileSettingsPage() {
  const [prefs, setPrefs] = useState<ProfilePreferences>({
    preferredAudioLanguages: [],
    preferredSubtitleLanguages: [],
    preferredSourceIds: [],
    maxVideoQuality: null,
    autoplayPreviews: true,
  })
  const [sources, setSources] = useState<SourceResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getProfile(), listSources()])
      .then(([p, s]) => {
        setPrefs(p.preferences)
        setSources(s)
      })
      .catch(() => setError('Impossible de charger les préférences.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const toSave = {
        ...prefs,
        preferredSourceIds: prefs.preferredSourceIds.filter((id) => sources.some((s) => s.id === id)),
      }
      const updated = await updateProfilePreferences(toSave)
      setPrefs(updated.preferences)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Erreur lors de la sauvegarde.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-8">
      <h1 className="text-2xl font-bold text-white mb-2">Préférences de lecture</h1>
      <p className="text-gray-400 text-sm mb-8">
        Ces préférences sont indépendantes de la langue de l'interface.
      </p>

      <form onSubmit={handleSave}>
        <LanguageListInput
          label="Langues audio préférées (ordre de priorité)"
          value={prefs.preferredAudioLanguages}
          onChange={(v) => setPrefs((p) => ({ ...p, preferredAudioLanguages: v }))}
        />

        <LanguageListInput
          label="Langues de sous-titres préférées (ordre de priorité)"
          value={prefs.preferredSubtitleLanguages}
          onChange={(v) => setPrefs((p) => ({ ...p, preferredSubtitleLanguages: v }))}
        />

        <SourcePriorityInput
          sources={sources}
          value={prefs.preferredSourceIds}
          onChange={(v) => setPrefs((p) => ({ ...p, preferredSourceIds: v }))}
        />

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Qualité vidéo maximale
          </label>
          <select
            value={prefs.maxVideoQuality ?? ''}
            onChange={(e) =>
              setPrefs((p) => ({
                ...p,
                maxVideoQuality: e.target.value === '' ? null : e.target.value,
              }))
            }
            className="bg-white/5 border border-white/10 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-white/30"
          >
            {QUALITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-[#111118]">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={prefs.autoplayPreviews}
              onChange={(e) => setPrefs((p) => ({ ...p, autoplayPreviews: e.target.checked }))}
              className="w-4 h-4 accent-[#e50914]"
            />
            <span className="text-sm font-medium text-gray-300">
              Activer les aperçus automatiques
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-7">
            Aperçu vidéo muet après un court délai au survol ou à la sélection d'un contenu.
          </p>
        </div>

        {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Enregistrer'}
          </Button>
          {saved && <span className="text-green-400 text-sm">Préférences sauvegardées</span>}
        </div>
      </form>
    </div>
  )
}
