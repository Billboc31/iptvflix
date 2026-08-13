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
  /** Title matches / local consolidations so far (useful while RUNNING). */
  titleMatched?: number
  /** Human-readable phase while status is RUNNING (fetch / match / upsert). */
  progress?: string | null
  error?: string | null
}

export type TriggerSyncBody = {
  sourceId: string
}
