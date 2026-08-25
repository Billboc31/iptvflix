import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.js'
import { ApiError } from '../lib/api.js'

function redirectAfterLogin(from: { pathname?: string; search?: string } | undefined): string {
  const path = from?.pathname
  if (!path || path === '/login') return '/profiles/choose'
  return `${path}${from.search ?? ''}`
}

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: { pathname: string; search: string } } | null)?.from
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const next = redirectAfterLogin(from)

  if (isAuthenticated) {
    navigate(next, { replace: true })
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await login(username, password)
      navigate('/profiles/choose', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError('Identifiant ou mot de passe incorrect')
      } else {
        setError('Connexion impossible. Veuillez réessayer.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-sm p-8 bg-[#111118] rounded-lg shadow-lg border border-white/5">
        <h1 className="text-2xl font-bold text-[#f97316] mb-2 tracking-tight">IPTVFlix</h1>
        <p className="text-gray-400 text-sm mb-6">Live TV</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1" htmlFor="username">
              Identifiant
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a24] text-white rounded border border-white/10 focus:outline-none focus:border-[#f97316]/50"
              required
              autoComplete="username"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1" htmlFor="password">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#1a1a24] text-white rounded border border-white/10 focus:outline-none focus:border-[#f97316]/50"
              required
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-400 text-sm" role="alert">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2 bg-[#f97316] text-white font-semibold rounded hover:bg-[#ea6a0a] disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
