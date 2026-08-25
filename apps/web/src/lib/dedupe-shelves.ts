import type { ShelfResponse } from '@iptvflix/api-contracts'

/** Append shelves without duplicating ids already present. */
export function mergeShelves(prev: ShelfResponse[], incoming: ShelfResponse[]): ShelfResponse[] {
  if (incoming.length === 0) return prev
  const seen = new Set(prev.map((s) => s.id))
  const fresh = incoming.filter((s) => !seen.has(s.id))
  return fresh.length > 0 ? [...prev, ...fresh] : prev
}

/** Remove duplicate shelf ids within a single page response. */
export function dedupeShelves(shelves: ShelfResponse[]): ShelfResponse[] {
  const seen = new Set<string>()
  return shelves.filter((s) => {
    if (seen.has(s.id)) return false
    seen.add(s.id)
    return true
  })
}
