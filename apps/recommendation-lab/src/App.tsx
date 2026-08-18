import { useState } from 'react'
import { QueryForm } from './components/QueryForm'
import { ResultGrid } from './components/ResultGrid'
import { DiagnosticPanel } from './components/DiagnosticPanel'
import { queryEngine } from './api'
import type { QueryRequest, QueryResponse, StageAvailability } from './api'

const styles = {
  root: {
    fontFamily: 'system-ui, -apple-system, monospace',
    background: '#0f0f0f',
    color: '#e0e0e0',
    minHeight: '100vh',
    padding: '0',
    margin: '0',
  },
  header: {
    background: '#1a1a1a',
    borderBottom: '1px solid #333',
    padding: '12px 24px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    color: '#fff',
    letterSpacing: '-0.3px',
  },
  badge: {
    background: '#2563eb',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    letterSpacing: '0.5px',
  },
  main: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '24px',
  },
  error: {
    background: '#2d1111',
    border: '1px solid #7f1d1d',
    color: '#fca5a5',
    padding: '12px 16px',
    borderRadius: '6px',
    marginTop: '16px',
    fontFamily: 'monospace',
    fontSize: '13px',
  },
}

export function App() {
  const [response, setResponse] = useState<QueryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stageAvailability: StageAvailability[] = response?.stageAvailability ?? []

  async function handleQuery(req: QueryRequest) {
    setLoading(true)
    setError(null)
    try {
      const res = await queryEngine({ ...req, debug: true })
      setResponse(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <h1 style={styles.title}>IPTVFlix</h1>
        <span style={styles.badge}>RECOMMENDATION LAB</span>
      </header>
      <main style={styles.main}>
        <QueryForm onSubmit={handleQuery} loading={loading} stageAvailability={stageAvailability} />
        {error && <div style={styles.error}>{error}</div>}
        {response && (
          <>
            <ResultGrid results={response.results} />
            <DiagnosticPanel response={response} />
          </>
        )}
      </main>
    </div>
  )
}
