import { renderHook } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { useFeaturedMedia } from './useFeaturedMedia.js'
import type { MovieResponse, SeriesResponse } from '@iptvflix/api-contracts'

const mockUseMovies = vi.hoisted(() => vi.fn())
const mockUseSeries = vi.hoisted(() => vi.fn())

vi.mock('./useMovies.js', () => ({ useMovies: () => mockUseMovies() }))
vi.mock('./useSeries.js', () => ({ useSeries: () => mockUseSeries() }))

function makeMovie(overrides: Partial<MovieResponse> = {}): MovieResponse {
  return {
    id: 'movie-1',
    title: 'Test Movie',
    year: 2024,
    synopsis: 'A test movie',
    posterUrl: 'https://example.com/poster.jpg',
    backdropUrl: 'https://example.com/backdrop.jpg',
    runtime: 120,
    genres: [],
    quality: null,
    availabilityCount: 1,
    availabilityStatus: 'AVAILABLE',
    trailerKey: 'trailer-abc',
    ...overrides,
  }
}

function makeSeries(overrides: Partial<SeriesResponse> = {}): SeriesResponse {
  return {
    id: 'series-1',
    title: 'Test Series',
    year: 2024,
    synopsis: 'A test series',
    posterUrl: 'https://example.com/series-poster.jpg',
    backdropUrl: 'https://example.com/series-backdrop.jpg',
    genres: [],
    seasonCount: 2,
    availabilityCount: 1,
    availabilityStatus: 'AVAILABLE',
    ...overrides,
  }
}

function paginated<T>(items: T[]) {
  return { items, total: items.length, page: 1, pageSize: 1 }
}

describe('useFeaturedMedia', () => {
  it('returns loading true until both fetches resolve', () => {
    mockUseMovies.mockReturnValue({ data: null, loading: true })
    mockUseSeries.mockReturnValue({ data: null, loading: false })
    const { result } = renderHook(() => useFeaturedMedia())
    expect(result.current.loading).toBe(true)
    expect(result.current.media).toBeNull()
  })

  it('prefers movie with backdrop over series without backdrop', () => {
    const movie = makeMovie({ backdropUrl: 'https://example.com/backdrop.jpg' })
    const series = makeSeries({ backdropUrl: null })
    mockUseMovies.mockReturnValue({ data: paginated([movie]), loading: false })
    mockUseSeries.mockReturnValue({ data: paginated([series]), loading: false })
    const { result } = renderHook(() => useFeaturedMedia())
    expect(result.current.media?.mediaType).toBe('movie')
    expect(result.current.media?.id).toBe('movie-1')
  })

  it('selects series with backdrop when movie has no backdrop', () => {
    const movie = makeMovie({ backdropUrl: null })
    const series = makeSeries({ backdropUrl: 'https://example.com/series-backdrop.jpg' })
    mockUseMovies.mockReturnValue({ data: paginated([movie]), loading: false })
    mockUseSeries.mockReturnValue({ data: paginated([series]), loading: false })
    const { result } = renderHook(() => useFeaturedMedia())
    expect(result.current.media?.mediaType).toBe('series')
    expect(result.current.media?.id).toBe('series-1')
  })

  it('falls back to movie without backdrop when series also has no backdrop', () => {
    const movie = makeMovie({ backdropUrl: null })
    const series = makeSeries({ backdropUrl: null })
    mockUseMovies.mockReturnValue({ data: paginated([movie]), loading: false })
    mockUseSeries.mockReturnValue({ data: paginated([series]), loading: false })
    const { result } = renderHook(() => useFeaturedMedia())
    expect(result.current.media?.mediaType).toBe('movie')
    expect(result.current.media?.backdropUrl).toBeNull()
  })

  it('returns null when both fetches return empty lists', () => {
    mockUseMovies.mockReturnValue({ data: paginated([]), loading: false })
    mockUseSeries.mockReturnValue({ data: paginated([]), loading: false })
    const { result } = renderHook(() => useFeaturedMedia())
    expect(result.current.media).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('sets trailerKey to null for series featured media', () => {
    const series = makeSeries({ backdropUrl: 'https://example.com/series-backdrop.jpg' })
    mockUseMovies.mockReturnValue({ data: paginated([]), loading: false })
    mockUseSeries.mockReturnValue({ data: paginated([series]), loading: false })
    const { result } = renderHook(() => useFeaturedMedia())
    expect(result.current.media?.mediaType).toBe('series')
    expect(result.current.media?.trailerKey).toBeNull()
  })
})
