import { it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
const { getEpisodeSegments } = vi.hoisted(() => ({ getEpisodeSegments: vi.fn().mockResolvedValue({ segments: [] }) }))
vi.mock('../lib/api.js', () => ({ getEpisodeSegments, getMovieSegments: vi.fn(), getProfile: vi.fn(), updateProfilePreferences: vi.fn() }))
import { useEpisodeSegments } from './useEpisodeSegments.js'
it('reloads source-bound corrections when the selected video changes', async () => {
 const { rerender } = renderHook(({ source }) => useEpisodeSegments('episode', 1452.456, source), { initialProps: { source: 'source-a' } })
 await waitFor(() => expect(getEpisodeSegments).toHaveBeenCalledWith('episode', 1452.456, 'source-a'))
 rerender({ source: 'source-b' })
 await waitFor(() => expect(getEpisodeSegments).toHaveBeenCalledWith('episode', 1452.456, 'source-b'))
})
