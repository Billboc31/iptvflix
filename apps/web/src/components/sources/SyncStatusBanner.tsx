import type { SyncRunResponse } from '@iptvflix/api-contracts'
import Badge from '../ui/Badge.js'
import Button from '../ui/Button.js'
import { useSchedulerStatus } from '../../hooks/useSchedulerStatus.js'

type SyncStatusBannerProps = {
  latestRun?: SyncRunResponse | null
  onSync: () => Promise<void>
  syncing?: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function formatCadence(minutes: number): string {
  return minutes >= 60 ? `${Math.round(minutes / 60)}h` : `${minutes}min`
}

const STATUS_VARIANT: Record<string, 'available' | 'unavailable' | 'info'> = {
  DONE: 'available',
  FAILED: 'unavailable',
  RUNNING: 'info',
  PENDING: 'info',
}

export default function SyncStatusBanner({
  latestRun,
  onSync,
  syncing = false,
}: SyncStatusBannerProps) {
  const schedulerStatus = useSchedulerStatus()

  return (
    <div className="bg-[#1a1a24] border border-white/5 rounded-lg px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {latestRun ? (
          <>
            <Badge variant={STATUS_VARIANT[latestRun.status] ?? 'info'}>{latestRun.status}</Badge>
            <span className="text-gray-400 text-sm">
              Dernière synchro : {formatDate(latestRun.startedAt)}
            </span>
            {latestRun.status === 'DONE' && (
              <span className="text-gray-500 text-xs">
                +{latestRun.moviesAdded} films · +{latestRun.seriesAdded} séries
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400 text-sm">Jamais synchronisé</span>
        )}
        {schedulerStatus !== null && (
          schedulerStatus.enabled ? (
            <>
              <Badge variant="info">
                Auto-sync {formatCadence(schedulerStatus.sourceSyncCadenceMinutes)}
              </Badge>
              {latestRun?.finishedAt && (
                <span className="text-gray-500 text-xs">
                  Prochaine ~{formatTime(
                    new Date(latestRun.finishedAt).getTime() +
                      schedulerStatus.sourceSyncCadenceMinutes * 60_000,
                  )}
                </span>
              )}
            </>
          ) : (
            <Badge variant="unavailable">Auto-sync désactivé</Badge>
          )
        )}
      </div>
      <Button size="sm" variant="secondary" loading={syncing} onClick={onSync}>
        Synchroniser
      </Button>
    </div>
  )
}
