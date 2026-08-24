import type { ShelfResponse } from './shelves.js'

export type MoviesPageResponse = {
  sessionId: string
  shelves: ShelfResponse[]
  nextCursor: string | null
}
