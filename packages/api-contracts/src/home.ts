import type { ShelfResponse } from './shelves.js'

export type HeroItem = {
  mediaId: string
  mediaType: 'MOVIE' | 'SERIES'
  title: string
  synopsis: string | null
  backdropUrl: string | null
  availabilityStatus: string
  trailerKey: string | null
}

export type HomeResponse = {
  coldStart: boolean
  shelves: ShelfResponse[]
}

export type HomePageResponse = {
  coldStart: boolean
  sessionId: string
  shelves: ShelfResponse[]
  nextCursor: string | null
  hero: HeroItem | null
}

export type SeriesPageResponse = {
  coldStart: boolean
  sessionId: string
  shelves: ShelfResponse[]
  nextCursor: string | null
}
