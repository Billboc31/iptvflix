import type { CandidateItem } from '../api'

interface ResultGridProps {
  results: CandidateItem[]
}

const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w300'

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
  count: {
    color: '#6b7280',
    fontWeight: 400,
    marginLeft: '6px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px',
  },
  card: {
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    borderRadius: '8px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  poster: {
    width: '100%',
    aspectRatio: '2/3',
    objectFit: 'cover' as const,
    display: 'block',
    background: '#0f0f0f',
  },
  posterPlaceholder: {
    width: '100%',
    aspectRatio: '2/3',
    background: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#4b5563',
    fontSize: '11px',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  info: { padding: '8px 10px' },
  title: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#e5e7eb',
    lineHeight: '1.3',
    margin: 0,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
  },
  meta: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    marginTop: '4px',
  },
  year: { fontSize: '11px', color: '#6b7280' },
  typeBadge: (type: string): React.CSSProperties => ({
    fontSize: '10px',
    fontWeight: 600,
    padding: '1px 5px',
    borderRadius: '3px',
    background: type === 'movie' ? '#1e3a5f' : '#1e3a2f',
    color: type === 'movie' ? '#93c5fd' : '#86efac',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.3px',
  }),
  score: {
    fontSize: '10px',
    color: '#d97706',
    marginTop: '2px',
  },
  empty: {
    color: '#6b7280',
    fontStyle: 'italic',
    fontSize: '14px',
    padding: '24px 0',
  },
}

export function ResultGrid({ results }: ResultGridProps) {
  return (
    <section style={styles.section}>
      <p style={styles.heading}>
        Results <span style={styles.count}>{results.length}</span>
      </p>

      {results.length === 0 ? (
        <p style={styles.empty}>No results — try a different query.</p>
      ) : (
        <div style={styles.grid}>
          {results.map((item) => (
            <div key={`${item.mediaType}-${item.id}`} style={styles.card}>
              {item.posterPath ? (
                <img
                  src={`${TMDB_IMAGE_BASE}${item.posterPath}`}
                  alt={item.title}
                  style={styles.poster}
                  loading="lazy"
                />
              ) : (
                <div style={styles.posterPlaceholder}>
                  <span>🎬</span>
                  <span>No poster</span>
                </div>
              )}
              <div style={styles.info}>
                <p style={styles.title} title={item.title}>
                  {item.title}
                </p>
                <div style={styles.meta}>
                  {item.year && <span style={styles.year}>{item.year}</span>}
                  <span style={styles.typeBadge(item.mediaType)}>{item.mediaType}</span>
                </div>
                {item.score !== undefined && (
                  <p style={styles.score}>score: {item.score.toFixed(3)}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
