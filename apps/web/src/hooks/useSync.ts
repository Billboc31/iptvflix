import { useState, useEffect, useCallback } from 'react'
import type { SyncRunResponse } from '@iptvflix/api-contracts'
import { listSyncRuns, triggerSync } from '../lib/api.js'

export type SyncState = {
  runs: SyncRunResponse[] | null
  loading: boolean
  error: Error | null
  refetch: () => void
  triggerSync: (sourceId: string) => Promise<SyncRunResponse>
}

const ACTIVE_STATUSES = new Set(['PENDING', 'RUNNING'])

export function useSync(): SyncState {
  const [runs, setRuns] = useState<SyncRunResponse[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refetch = useCallback(async () => {
    try {
      setRuns(await listSyncRuns())
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  // Auto-poll every 3 s while any run is PENDING or RUNNING
  useEffect(() => {
    const hasActive = runs?.some((r) => ACTIVE_STATUSES.has(r.status))
    if (!hasActive) return
    const id = setInterval(refetch, 3000)
    return () => clearInterval(id)
  }, [runs, refetch])

  const handleTrigger = useCallback(async (sourceId: string) => {
    const run = await triggerSync({ sourceId })
    setRuns((prev) => (prev ? [run, ...prev] : [run]))
    return run
  }, [])

  return { runs, loading, error, refetch, triggerSync: handleTrigger }
}
