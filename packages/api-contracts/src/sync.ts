export type SyncRunStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

export type SyncRunResponse = {
  id: string
  sourceId: string
  status: SyncRunStatus
  startedAt: string
  finishedAt: string | null
  moviesAdded: number
  seriesAdded: number
  seriesInfoFailed?: number
  error?: string | null
}

export type TriggerSyncBody = {
  sourceId: string
}
