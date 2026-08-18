import type { StageAvailability } from '../api'

interface StageToggleProps {
  stage: StageAvailability
}

const styles = {
  pill: (available: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 500,
    border: `1px solid ${available ? '#166534' : '#374151'}`,
    background: available ? '#052e16' : '#1f2937',
    color: available ? '#4ade80' : '#6b7280',
    cursor: 'default',
    userSelect: 'none',
  }),
  dot: (available: boolean): React.CSSProperties => ({
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: available ? '#4ade80' : '#4b5563',
    flexShrink: 0,
  }),
}

const STAGE_LABELS: Record<string, string> = {
  'text-search': 'Text Search',
  'semantic-search': 'Semantic Search',
  'llm-planner': 'LLM Planner',
}

export function StageToggle({ stage }: StageToggleProps) {
  const label = STAGE_LABELS[stage.name] ?? stage.name
  const title = stage.available ? 'Active' : (stage.reason ?? 'not configured')

  return (
    <span style={styles.pill(stage.available)} title={title}>
      <span style={styles.dot(stage.available)} />
      {label}
      {!stage.available && <span style={{ fontSize: '10px', opacity: 0.7 }}>✕</span>}
    </span>
  )
}
