import { describe, expect, it, vi } from 'vitest'
vi.mock('../db/client.js', () => ({ db: { select: vi.fn() } }))
import { matchVerifiedSegments, mergeVerifiedSegments, getVerifiedEpisodeSegments } from './verified-playback-segments.js'
const credits = { type: 'CREDITS' as const, durationMs: 1452456, startMs: 1376000, endMs: 1452456 }
describe('reviewed source-specific cuts', () => {
  it('requires a measured compatible duration and tolerates only sub-second rounding', () => {
    expect(matchVerifiedSegments([credits])).toEqual([])
    expect(matchVerifiedSegments([credits], 1468.658)).toEqual([])
    expect(matchVerifiedSegments([credits], 1452)[0]).toMatchObject({ endMs: 1452000, autoSkipSafe: true })
    expect(matchVerifiedSegments([credits], 1452.456)[0]).toMatchObject({ endMs: 1452456 })
    expect(matchVerifiedSegments([credits], 1451.9)).toEqual([])
  })
  it('rejects malformed corrections instead of cutting story', () => {
    expect(matchVerifiedSegments([{ ...credits, startMs: -1 }, { ...credits, endMs: 1500000 }, { ...credits, startMs: credits.endMs }], 1452.456)).toEqual([])
  })
  it('preserves upstream intro and recap while replacing a conflicting outro', () => {
    const online = [{ type: 'INTRO' as const, startMs: 0, endMs: 110000 }, { type: 'OUTRO' as const, startMs: 1300000, endMs: 1450000 }]
    const merged = mergeVerifiedSegments(online, matchVerifiedSegments([credits], 1452.456))
    expect(merged.map(s => s.type)).toEqual(['INTRO', 'CREDITS'])
    expect(merged[1].startMs).toBe(1376000)
  })
  it('does not apply corrections without the selected source', async () => {
    expect(await getVerifiedEpisodeSegments('episode', undefined, 1452.456)).toEqual([])
  })
})
