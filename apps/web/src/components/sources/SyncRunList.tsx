import type { SyncRunResponse } from '@iptvflix/api-contracts'
import Badge from '../ui/Badge.js'

type SyncRunListProps = {
  runs: SyncRunResponse[]
}

const STATUS_VARIANT: Record<string, 'available' | 'unavailable' | 'info'> = {
  DONE: 'available',
  FAILED: 'unavailable',
  RUNNING: 'info',
  PENDING: 'info',
}

function fmt(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function SyncRunList({ runs }: SyncRunListProps) {
  if (runs.length === 0) {
    return <p className="text-gray-500 text-sm py-4">Aucune synchronisation effectuée.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/5">
      <table className="w-full text-sm text-left">
        <thead className="bg-[#1a1a24]">
          <tr className="text-gray-400">
            <th className="px-4 py-3 font-medium">Statut</th>
            <th className="px-4 py-3 font-medium">Début</th>
            <th className="px-4 py-3 font-medium">Fin</th>
            <th className="px-4 py-3 font-medium text-right">Films</th>
            <th className="px-4 py-3 font-medium text-right">Séries</th>
            <th className="px-4 py-3 font-medium">Erreur</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-t border-white/5 hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <Badge variant={STATUS_VARIANT[run.status] ?? 'info'}>{run.status}</Badge>
              </td>
              <td className="px-4 py-3 text-gray-300">{fmt(run.startedAt)}</td>
              <td className="px-4 py-3 text-gray-300">{fmt(run.finishedAt)}</td>
              <td className="px-4 py-3 text-right text-gray-300">+{run.moviesAdded}</td>
              <td className="px-4 py-3 text-right text-gray-300">+{run.seriesAdded}</td>
              <td className="px-4 py-3 text-red-400 text-xs max-w-xs truncate">
                {run.error ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
