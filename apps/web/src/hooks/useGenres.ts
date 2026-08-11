import type { GenreResponse } from '@iptvflix/api-contracts'
import { listGenres } from '../lib/api.js'
import { useApi } from './useApi.js'

export function useGenres(): { genres: GenreResponse[]; loading: boolean } {
  const { data, loading } = useApi<GenreResponse[]>(listGenres)
  return { genres: data ?? [], loading }
}
