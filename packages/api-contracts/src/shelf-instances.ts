export type ShelfInstanceItemDetail = {
  id: string
  shelfInstanceId: string
  mediaType: string
  mediaId: string
  rankPosition: number
  semanticScore: number | null
  profileScore: number | null
  finalScore: number | null
  diversityAdjustment: number | null
  availabilityStatus: string | null
  reasonCodes: string[]
  wasEligibleAtGeneration: boolean
  wasVisible: boolean
  openedAt: string | null
  playedAt: string | null
}

export type ShelfInstanceDetail = {
  id: string
  profileId: string
  shelfConceptId: string | null
  title: string
  semanticIntentSnapshot: string | null
  generationType: string | null
  generationReasonCodes: string[]
  homeSessionId: string | null
  verticalPosition: number | null
  rankerVersion: string
  queryPlannerVersion: string
  embeddingModelVersion: string
  candidateCount: number | null
  finalItemCount: number | null
  latencyMs: number | null
  cacheHit: boolean
  createdAt: string
  firstDisplayedAt: string | null
  lastDisplayedAt: string | null
  expiresAt: string | null
  items: ShelfInstanceItemDetail[]
}

export type ConceptPerformance = {
  shelfConceptId: string
  profileId: string
  impressionCount: number
  visibleRate: number
  openRate: number
  playRate: number
}

export type FatigueState = {
  shelfConceptId: string
  impressionCount: number
  visibleImpressionCount: number
  zeroInteractionStreakCount: number
  lastShownAt: string | null
  cooldownUntil: string | null
  suppressionReason: string | null
  suppressionVersion: string | null
  updatedAt: string
}

export type ProfileMediaExposureEntry = {
  profileId: string
  mediaType: string
  mediaId: string
  exposureCount: number
  firstExposedAt: string
  lastExposedAt: string
  openCount: number
  playCount: number
  lastOpenedAt: string | null
  lastPlayedAt: string | null
  shownInConceptIds: string[]
}

export type ShelfHistoryEntry = {
  instanceId: string
  conceptId: string | null
  conceptTitle: string | null
  renderedTitle: string
  itemCount: number | null
  firstDisplayedAt: string | null
  createdAt: string
  impressionCount: number
  visibleRate: number
  openRate: number
  playRate: number
  fatigueState: FatigueState | null
}

export type ShelfInstanceTrace = {
  instance: ShelfInstanceDetail
  fatigueAtDisplay: FatigueState | null
}

export type PersistShelfInstanceItemParams = {
  mediaType: string
  mediaId: string
  rankPosition: number
  semanticScore?: number | null
  profileScore?: number | null
  finalScore?: number | null
  diversityAdjustment?: number | null
  availabilityStatus?: string | null
  reasonCodes?: string[]
  wasEligibleAtGeneration?: boolean
}

export type PersistShelfInstanceParams = {
  profileId: string
  shelfConceptId: string | null
  title: string
  semanticIntentSnapshot?: string | null
  generationType?: string | null
  generationReasonCodes?: string[]
  homeSessionId?: string | null
  seriesSessionId?: string | null
  moviesSessionId?: string | null
  verticalPosition?: number | null
  rankerVersion: string
  queryPlannerVersion: string
  embeddingModelVersion: string
  candidateCount?: number | null
  latencyMs?: number | null
  cacheHit?: boolean
  expiresAt?: Date | null
  servedAt?: Date | null
  items: PersistShelfInstanceItemParams[]
}
