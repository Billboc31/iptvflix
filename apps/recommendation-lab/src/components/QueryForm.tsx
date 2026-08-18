import { useState } from 'react'
import type { QueryRequest, StageAvailability } from '../api'
import { StageToggle } from './StageToggle'

interface QueryFormProps {
  onSubmit: (req: QueryRequest) => void
  loading: boolean
  stageAvailability: StageAvailability[]
}

const styles = {
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    padding: '20px',
  },
  row: {
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-end',
    flexWrap: 'wrap' as const,
    marginBottom: '12px',
  },
  group: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '6px',
  },
  label: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  input: {
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#e0e0e0',
    padding: '8px 12px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  textInput: {
    width: '420px',
    maxWidth: '100%',
  },
  select: {
    background: '#0f0f0f',
    border: '1px solid #333',
    borderRadius: '6px',
    color: '#e0e0e0',
    padding: '8px 12px',
    fontSize: '14px',
    outline: 'none',
    fontFamily: 'inherit',
  },
  button: (loading: boolean): React.CSSProperties => ({
    background: loading ? '#1d4ed8' : '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    padding: '8px 20px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    fontFamily: 'inherit',
    minWidth: '100px',
  }),
  stages: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    marginTop: '4px',
  },
  stagesLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginRight: '4px',
  },
}

const KNOWN_STAGES: StageAvailability[] = [
  { name: 'llm-planner', available: false, reason: 'OPENAI_API_KEY not configured' },
  { name: 'text-search', available: true },
  { name: 'semantic-search', available: false, reason: 'no embeddings indexed' },
]

export function QueryForm({ onSubmit, loading, stageAvailability }: QueryFormProps) {
  const [text, setText] = useState('')
  const [profileId, setProfileId] = useState('')
  const [mediaType, setMediaType] = useState<'movie' | 'series' | 'both'>('both')
  const [limit, setLimit] = useState(24)

  const displayStages = stageAvailability.length > 0 ? stageAvailability : KNOWN_STAGES

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    const mediaTypes: ('movie' | 'series')[] =
      mediaType === 'both' ? ['movie', 'series'] : [mediaType]
    onSubmit({
      text: text.trim(),
      profileId: profileId.trim() || undefined,
      mediaTypes,
      limit,
    })
  }

  return (
    <form onSubmit={handleSubmit} style={styles.card}>
      <div style={styles.row}>
        <div style={{ ...styles.group, flex: 1 }}>
          <label style={styles.label}>Query</label>
          <input
            style={{ ...styles.input, ...styles.textInput, width: '100%' }}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"e.g. \"SF qui fait réfléchir, sombre, peu d'action\""}
            disabled={loading}
            autoFocus
          />
        </div>
      </div>

      <div style={styles.row}>
        <div style={styles.group}>
          <label style={styles.label}>Profile ID (optional)</label>
          <input
            style={{ ...styles.input, width: '260px' }}
            value={profileId}
            onChange={(e) => setProfileId(e.target.value)}
            placeholder="uuid"
            disabled={loading}
          />
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Content type</label>
          <select
            style={styles.select}
            value={mediaType}
            onChange={(e) => setMediaType(e.target.value as 'movie' | 'series' | 'both')}
            disabled={loading}
          >
            <option value="both">Movies + Series</option>
            <option value="movie">Movies only</option>
            <option value="series">Series only</option>
          </select>
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Limit</label>
          <select
            style={styles.select}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            disabled={loading}
          >
            <option value={10}>10</option>
            <option value={24}>24</option>
            <option value={50}>50</option>
          </select>
        </div>

        <button type="submit" style={styles.button(loading)} disabled={loading || !text.trim()}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </div>

      <div style={styles.stages}>
        <span style={styles.stagesLabel}>Stages:</span>
        {displayStages.map((s) => (
          <StageToggle key={s.name} stage={s} />
        ))}
      </div>
    </form>
  )
}
