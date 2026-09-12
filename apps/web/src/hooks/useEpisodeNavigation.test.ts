import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useEpisodeNavigation } from './useEpisodeNavigation.js'
const api = vi.hoisted(() => ({ getSeriesSeasonEpisodes: vi.fn(), getEpisodeContext: vi.fn(), getSeries: vi.fn() }))
vi.mock('../lib/api.js', () => api)
const episode = (id: string, episodeNumber: number, availabilityStatus = 'AVAILABLE') => ({ id, episodeNumber, title: id, availabilityStatus })
beforeEach(() => vi.resetAllMocks())
describe('episode navigation', () => {
  it('loads next season with its correct number', async () => {
    api.getSeriesSeasonEpisodes.mockImplementation((_id, season) => Promise.resolve(season === 1 ? [episode('current', 12)] : [episode('next', 1)]))
    api.getSeries.mockResolvedValue({ seasons: [{ seasonNumber: 1 }, { seasonNumber: 2 }] })
    const { result } = renderHook(() => useEpisodeNavigation('current', 'series', 1))
    await waitFor(() => expect(result.current.nextEpisode?.id).toBe('next'))
    expect(result.current.nextSeasonNumber).toBe(2)
  })
  it('does not jump over missing episodes', async () => {
    api.getSeriesSeasonEpisodes.mockResolvedValue([episode('current', 3), episode('later', 5)])
    const { result } = renderHook(() => useEpisodeNavigation('current', 'series', 1))
    await waitFor(() => expect(result.current.episodeLabel).toContain('S01E03'))
    expect(result.current.nextEpisode).toBeNull()
  })
  it('does not offer unavailable next episodes', async () => {
    api.getSeriesSeasonEpisodes.mockResolvedValue([episode('current', 3), episode('next', 4, 'UNAVAILABLE')])
    const { result } = renderHook(() => useEpisodeNavigation('current', 'series', 1))
    await waitFor(() => expect(result.current.episodeLabel).toContain('S01E03'))
    expect(result.current.nextEpisode).toBeNull()
  })
})
