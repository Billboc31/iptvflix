import { useState, useEffect } from 'react'

export type SchedulerStatus = {
  enabled: boolean
  sourceSyncCadenceMinutes: number
  discoveryCadenceMinutes: number
}

export function useSchedulerStatus(): SchedulerStatus | null {
  const [status, setStatus] = useState<SchedulerStatus | null>(null)

  useEffect(() => {
    const base = import.meta.env.VITE_API_BASE ?? '/api'
    fetch(`${base}/scheduler/status`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<SchedulerStatus>) : null))
      .then((data) => {
        if (data) setStatus(data)
      })
      .catch(() => {})
  }, [])

  return status
}
