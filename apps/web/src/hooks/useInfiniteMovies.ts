import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchMoviesPage } from '../lib/api.js'
import { dedupeShelves, mergeShelves } from '../lib/dedupe-shelves.js'
import type { ShelfResponse } from '@iptvflix/api-contracts'

export type UseInfiniteMoviesResult = {
  allShelves: ShelfResponse[]
  sessionId: string | null
  nextCursor: string | null
  isLoading: boolean
  isFetchingMore: boolean
  hasMore: boolean
  error: Error | null
  loadMore: () => void
}

const MAX_RETRIES = 3

export function useInfiniteMovies(profileId: string, profileVersion: number): UseInfiniteMoviesResult {
  const [allShelves, setAllShelves] = useState<ShelfResponse[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetchingMore, setIsFetchingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const isFetchingMoreRef = useRef(false)

  useEffect(() => {
    if (!profileId) {
      setIsLoading(false)
      return
    }
    let cancelled = false

    setAllShelves([])
    setSessionId(null)
    setNextCursor(null)
    setHasMore(true)
    setError(null)
    setIsLoading(true)
    isFetchingMoreRef.current = false

    let attempt = 0

    async function load() {
      while (attempt < MAX_RETRIES) {
        try {
          const result = await fetchMoviesPage(profileId)
          if (!cancelled) {
            setAllShelves(dedupeShelves(result.shelves ?? []))
            setSessionId(result.sessionId)
            setNextCursor(result.nextCursor)
            setHasMore(result.nextCursor !== null)
            setIsLoading(false)
          }
          return
        } catch (err) {
          attempt++
          if (attempt >= MAX_RETRIES || cancelled) {
            if (!cancelled) {
              setError(err as Error)
              setIsLoading(false)
            }
            return
          }
          await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)))
        }
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [profileId, profileVersion])

  const loadMore = useCallback(() => {
    if (isFetchingMoreRef.current || !nextCursor || !profileId) return
    isFetchingMoreRef.current = true
    setIsFetchingMore(true)

    let attempt = 0
    const cursorToFetch = nextCursor

    async function fetchMore() {
      while (attempt < MAX_RETRIES) {
        try {
          const result = await fetchMoviesPage(profileId, cursorToFetch)
          setAllShelves((prev) => mergeShelves(prev, result.shelves ?? []))
          setSessionId(result.sessionId)
          setNextCursor(result.nextCursor)
          setHasMore(result.nextCursor !== null)
          setIsFetchingMore(false)
          isFetchingMoreRef.current = false
          return
        } catch (err) {
          attempt++
          if (attempt >= MAX_RETRIES) {
            setError(err as Error)
            setIsFetchingMore(false)
            isFetchingMoreRef.current = false
            return
          }
          await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)))
        }
      }
    }

    fetchMore()
  }, [profileId, nextCursor])

  return { allShelves, sessionId, nextCursor, isLoading, isFetchingMore, hasMore, error, loadMore }
}
