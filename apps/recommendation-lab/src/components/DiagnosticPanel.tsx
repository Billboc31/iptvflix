import { useState } from 'react'
import type { QueryResponse } from '../api'

interface DiagnosticPanelProps {
  response: QueryResponse
}

const styles = {
  section: { marginTop: '24px' },
  heading: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#9ca3af',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  tabBar: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #2a2a2a',
    marginBottom: '0',
  },
  tab: (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: active ? 600 : 400,
    color: active ? '#e0e0e0' : '#6b7280',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: '-1px',
  }),
  panel: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderTop: 'none',
    borderRadius: '0 0 8px 8px',
  },
  pre: {
    margin: 0,
    padding: '16px',
    fontSize: '12px',
    color: '#d1d5db',
    overflow: 'auto',
    maxHeight: '400px',
    lineHeight: '1.5',
    fontFamily: 'monospace',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '13px',
  },
  th: {
    padding: '8px 16px',
    textAlign: 'left' as const,
    color: '#6b7280',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
    borderBottom: '1px solid #2a2a2a',
  },
  td: {
    padding: '8px 16px',
    borderBottom: '1px solid #1f1f1f',
    color: '#d1d5db',
    fontFamily: 'monospace',
  },
  available: (v: boolean): React.CSSProperties => ({
    color: v ? '#4ade80' : '#ef4444',
    fontWeight: 600,
  }),
  totalRow: {
    fontWeight: 600,
    color: '#e0e0e0',
  },
}

export function DiagnosticPanel({ response }: DiagnosticPanelProps) {
  const [activeTab, setActiveTab] = useState<'timing' | 'raw'>('timing')

  const responseWithoutCandidates = {
    ...response,
    stageOutputs: response.stageOutputs.map(({ candidates: _, ...s }) => s),
  }

  return (
    <section style={styles.section}>
      <p style={styles.heading}>Diagnostics</p>

      <div>
        <div style={styles.tabBar}>
          <button style={styles.tab(activeTab === 'timing')} onClick={() => setActiveTab('timing')}>
            Timing &amp; Stages
          </button>
          <button style={styles.tab(activeTab === 'raw')} onClick={() => setActiveTab('raw')}>
            Raw Response
          </button>
        </div>

        <div style={styles.panel}>
          {activeTab === 'timing' && (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Stage</th>
                  <th style={styles.th}>Available</th>
                  <th style={styles.th}>Duration (ms)</th>
                  <th style={styles.th}>Output count</th>
                  <th style={styles.th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {response.stageOutputs.map((s) => (
                  <tr key={s.stage}>
                    <td style={styles.td}>{s.stage}</td>
                    <td style={styles.td}>
                      <span style={styles.available(s.available)}>{s.available ? 'yes' : 'no'}</span>
                    </td>
                    <td style={styles.td}>{s.durationMs}</td>
                    <td style={styles.td}>{s.outputCount}</td>
                    <td style={{ ...styles.td, color: '#6b7280', fontSize: '12px' }}>
                      {s.reason ?? '—'}
                    </td>
                  </tr>
                ))}
                <tr style={styles.totalRow}>
                  <td style={styles.td}>total</td>
                  <td style={styles.td} />
                  <td style={styles.td}>{response.timing.totalMs}</td>
                  <td style={styles.td}>{response.results.length}</td>
                  <td style={styles.td} />
                </tr>
              </tbody>
            </table>
          )}

          {activeTab === 'raw' && (
            <pre style={styles.pre}>
              {JSON.stringify(responseWithoutCandidates, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </section>
  )
}
