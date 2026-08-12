export type ShelfType = 'SYSTEM' | 'MANUAL' | 'DYNAMIC' | 'GENERATED'
export type LayoutHint = 'ROW' | 'GRID'

export type ShelfItem = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
  title: string
  posterUrl: string | null
  progressSeconds?: number
  durationSeconds?: number
  trailerKey?: string | null
}

export type ShelfResponse = {
  id: string
  title: string
  type: ShelfType
  layoutHint: LayoutHint
  items: ShelfItem[]
  generatedAt?: string
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

export type SeedMediaRef = {
  mediaType: 'MOVIE' | 'SERIES'
  mediaId: string
}

export type GeneratedShelfRules = {
  seedMediaIds: SeedMediaRef[]
  mediaType?: 'MOVIE' | 'SERIES'
  availableToMe?: boolean
  limit: number
  inferredGenreIds: string[]
  generatedAt: string
}

export type GenerateShelfBody = {
  title: string
  seedMediaIds: SeedMediaRef[]
  mediaType?: 'MOVIE' | 'SERIES'
  availableToMe?: boolean
  limit?: number
}

export type GenerateShelfResponse = {
  shelf: ShelfSummaryResponse
  explanation: {
    inferredGenreIds: string[]
    seedTitles: string[]
    generatedAt: string
  }
}
