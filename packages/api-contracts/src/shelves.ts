export type ShelfType = 'SYSTEM' | 'MANUAL' | 'DYNAMIC'
export type LayoutHint = 'ROW' | 'GRID'

export type ShelfItem = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
  title: string
  posterUrl: string | null
  progressSeconds?: number
  durationSeconds?: number
}

export type ShelfResponse = {
  id: string
  title: string
  type: ShelfType
  layoutHint: LayoutHint
  items: ShelfItem[]
}

export type ShelfSummaryResponse = {
  id: string
  title: string
  type: ShelfType
  layoutHint: LayoutHint
  position: number
}

export type ShelfRuleDefinition = {
  mediaType?: 'MOVIE' | 'SERIES'
  genreIds?: string[]
  yearFrom?: number
  yearTo?: number
  availableToMe?: boolean
  watchState?: 'UNWATCHED' | 'IN_PROGRESS' | 'COMPLETED'
}

export type CreateShelfBody = {
  title: string
  type: 'MANUAL' | 'DYNAMIC'
  rules?: ShelfRuleDefinition
  layoutHint?: LayoutHint
}

export type UpdateShelfBody = {
  title?: string
  layoutHint?: LayoutHint
}

export type AddShelfMemberBody = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
}

export type ReorderShelfMembersBody = {
  members: Array<{ mediaType: 'MOVIE' | 'SERIES'; mediaId: string }>
}
