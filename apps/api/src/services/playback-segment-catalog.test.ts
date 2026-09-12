import { afterEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ execute: vi.fn(), insert: vi.fn(), values: vi.fn(), upsert: vi.fn(), lookup: vi.fn() }))
vi.mock('../db/client.js', () => ({ db: { transaction: (fn: (tx: unknown) => unknown) => fn({ execute: mocks.execute, insert: mocks.insert }) } }))
vi.mock('./playback-segments.js', () => ({ configureSegmentResponseCache: vi.fn(), segmentRequestCount: () => 0, lookupPlaybackSegments: mocks.lookup }))
import { refreshPlaybackSegmentBatch } from './playback-segment-catalog.js'
afterEach(() => { vi.useRealTimers(); vi.resetAllMocks() })
function setup() {
  vi.useFakeTimers()
  mocks.execute.mockResolvedValueOnce([{ acquired: true }]).mockResolvedValueOnce([{ media_type: 'movie', id: 'a', imdb_id: 'tt123', tmdb_id: null, season_number: 0, episode_number: 0 }])
  mocks.insert.mockReturnValue({ values: mocks.values })
  mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.upsert })
  mocks.upsert.mockResolvedValue(undefined)
}
describe('persistent catalog refresh', () => {
  it('records absence and schedules a daily retry', async () => {
    setup(); mocks.lookup.mockResolvedValue([])
    const result = refreshPlaybackSegmentBatch()
    await vi.runAllTimersAsync()
    expect(await result).toBe(1)
    const record = mocks.values.mock.calls[0][0]
    expect(record.segments).toEqual([])
    expect(record.retryAt.getTime() - record.checkedAt.getTime()).toBe(86400000)
  })
  it('preserves known segments on provider error and retries sooner', async () => {
    setup(); mocks.lookup.mockRejectedValue(new Error('429'))
    const result = refreshPlaybackSegmentBatch()
    await vi.runAllTimersAsync(); await result
    const update = mocks.upsert.mock.calls[0][0].set
    expect(update).not.toHaveProperty('segments')
    expect(update.lastError).toContain('retry')
  })
  it('does not run simultaneously on another Railway instance', async () => {
    mocks.execute.mockResolvedValue([{ acquired: false }])
    expect(await refreshPlaybackSegmentBatch()).toBe(0)
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
})
