import type { ShelfResponse } from './shelves.js'

export type HomeResponse = {
  coldStart: boolean
  shelves: ShelfResponse[]
}

export type HomePageResponse = {
  coldStart: boolean
  sessionId: string
  shelves: ShelfResponse[]
  nextCursor: string | null
}
