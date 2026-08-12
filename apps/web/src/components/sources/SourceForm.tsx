import { useState, type FormEvent } from 'react'
import type { SourceResponse, CreateSourceBody, UpdateSourceBody, SourceType } from '@iptvflix/api-contracts'
import Button from '../ui/Button.js'

type SourceFormProps = {
  initial?: SourceResponse
  onSubmit: (body: CreateSourceBody | UpdateSourceBody) => Promise<void>
  onTest?: (id: string) => Promise<{ ok: boolean; message: string }>
  onClose: () => void
}

type TestState = { ok: boolean; message: string } | null

export default function SourceForm({ initial, onSubmit, onTest, onClose }: SourceFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [type, setType] = useState<SourceType>(initial?.type ?? 'XTREAM')
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? '')
  const [username, setUsername] = useState(initial?.username ?? '')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<TestState>(null)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    if (!initial?.id || !onTest) return
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(initial.id)
      setTestResult(result)
    } catch (e) {
      setTestResult({ ok: false, message: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const body: CreateSourceBody = {
        name,
        type,
        baseUrl,
        username: type === 'PLEX' ? null : (username || null),
        password: password || null,
      }
      await onSubmit(body)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label className="block text-sm text-gray-400 mb-1" htmlFor="source-name">
          Nom
        </label>
        <input
          id="source-name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ma source IPTV"
          className="w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        />
      </div>

      {/* Type */}
      <div>
        <p className="text-sm text-gray-400 mb-2">Type</p>
        <div className="flex gap-4">
          {(['XTREAM', 'M3U', 'PLEX'] as SourceType[]).map((t) => (
            <label key={t} className="flex items-center gap-2 cursor-pointer text-sm text-white">
              <input
                type="radio"
                name="source-type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="accent-[#e50914]"
              />
              {t}
            </label>
          ))}
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-sm text-gray-400 mb-1" htmlFor="source-baseurl">
          URL de base
        </label>
        <input
          id="source-baseurl"
          required
          type="url"
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder={type === 'PLEX' ? 'http://plex-server.example.com:32400' : 'http://provider.example.com'}
          className="w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        />
      </div>

      {/* Username — hidden for PLEX */}
      {type !== 'PLEX' && (
        <div>
          <label className="block text-sm text-gray-400 mb-1" htmlFor="source-username">
            Identifiant
          </label>
          <input
            id="source-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
          />
        </div>
      )}

      {/* Password / Plex Token */}
      <div>
        <label className="block text-sm text-gray-400 mb-1" htmlFor="source-password">
          {type === 'PLEX' ? 'Plex Token' : 'Mot de passe'}
        </label>
        <input
          id="source-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={type === 'PLEX' ? 'Votre token Plex' : undefined}
          className="w-full bg-[#111118] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#e50914]/50"
        />
      </div>

      {/* Test connection (edit mode only) */}
      {initial && onTest && (
        <div>
          <Button type="button" variant="secondary" size="sm" loading={testing} onClick={handleTest}>
            Tester la connexion
          </Button>
          {testResult && (
            <p className={`text-sm mt-2 ${testResult.ok ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.ok ? '✓' : '✗'} {testResult.message}
            </p>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annuler
        </Button>
        <Button type="submit" loading={saving}>
          {initial ? 'Enregistrer' : 'Ajouter'}
        </Button>
      </div>
    </form>
  )
}
