import type { ShelfResponse } from './shelves.js'

export type HomeResponse = {
  coldStart: boolean
  shelves: ShelfResponse[]
}
