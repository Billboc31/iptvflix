import { useEffect, useState } from 'react'
import type { HealthResponse } from '@iptvflix/api-contracts'

const API_BASE = import.meta.env.VITE_API_BASE ?? '/api'

export default function App() {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/health`)
      .then((res) => res.json() as Promise<HealthResponse>)
      .then((data) => setStatus(data.status))
      .catch(() => setError('Could not reach API'))
  }, [])

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>IPTVFlix</h1>
      {error && <p style={{ color: 'red' }}>API: {error}</p>}
      {status && <p>API status: {status}</p>}
      {!status && !error && <p>Connecting to API…</p>}
    </main>
  )
}
