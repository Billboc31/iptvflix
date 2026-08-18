import { describe, it, expect } from 'vitest'
import { mapIntroDbResponse } from '../mapper.js'
import type { IntroDbSegmentResponse } from '../types.js'

const EPISODE_ID = 'ep-uuid-001'

describe('mapIntroDbResponse()', () => {
  it('maps intro, recap, and outro to RawSegment[]', () => {
    const raw: IntroDbSegmentResponse = {
      intro: { start: 115, end: 178 },
      recap: { start: 0, end: 62 },
      outro: { start: 1421, end: 1485 },
      confidence: 0.9,
      submissionCount: 20,
    }
    const result = mapIntroDbResponse(raw, EPISODE_ID)
    expect(result).toHaveLength(3)

    const recap = result.find((s) => s.type === 'RECAP')!
    expect(recap.startMs).toBe(0)
    expect(recap.endMs).toBe(62000)
    expect(recap.sourceProvider).toBe('introdb')
    expect(recap.confidence).toBe(0.9)
    expect(recap.submissionCount).toBe(20)

    const intro = result.find((s) => s.type === 'INTRO')!
    expect(intro.startMs).toBe(115000)
    expect(intro.endMs).toBe(178000)

    const outro = result.find((s) => s.type === 'OUTRO')!
    expect(outro.startMs).toBe(1421000)
    expect(outro.endMs).toBe(1485000)
  })

  it('handles missing recap gracefully (only intro + outro)', () => {
    const raw: IntroDbSegmentResponse = {
      intro: { start: 90, end: 150 },
      outro: { start: 1300, end: 1380 },
    }
    const result = mapIntroDbResponse(raw, EPISODE_ID)
    expect(result).toHaveLength(2)
    expect(result.map((s) => s.type)).toContain('INTRO')
    expect(result.map((s) => s.type)).toContain('OUTRO')
    expect(result.map((s) => s.type)).not.toContain('RECAP')
  })

  it('returns empty array when all segments are absent', () => {
    const raw: IntroDbSegmentResponse = {}
    const result = mapIntroDbResponse(raw, EPISODE_ID)
    expect(result).toEqual([])
  })

  it('converts seconds to milliseconds (rounds)', () => {
    const raw: IntroDbSegmentResponse = { intro: { start: 1.5, end: 2.9 } }
    const result = mapIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].startMs).toBe(1500)
    expect(result[0].endMs).toBe(2900)
  })

  it('sets sourceUpdatedAt when updatedAt is present', () => {
    const raw: IntroDbSegmentResponse = {
      intro: { start: 10, end: 50 },
      updatedAt: '2025-01-15T12:00:00Z',
    }
    const result = mapIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].sourceUpdatedAt).toBeInstanceOf(Date)
    expect(result[0].sourceUpdatedAt!.toISOString()).toBe('2025-01-15T12:00:00.000Z')
  })

  it('sets undefined for confidence and submissionCount when absent', () => {
    const raw: IntroDbSegmentResponse = { intro: { start: 0, end: 60 } }
    const result = mapIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].confidence).toBeUndefined()
    expect(result[0].submissionCount).toBeUndefined()
  })

  it('maps anime episode with intro+recap correctly (One Piece fixture)', () => {
    const raw: IntroDbSegmentResponse = {
      recap: { start: 0, end: 95 },
      intro: { start: 95, end: 185 },
      outro: { start: 1330, end: 1410 },
      submissionCount: 200,
    }
    const result = mapIntroDbResponse(raw, 'one-piece-ep-1')
    expect(result).toHaveLength(3)
    expect(result.find((s) => s.type === 'RECAP')?.endMs).toBe(95000)
    expect(result.find((s) => s.type === 'INTRO')?.startMs).toBe(95000)
    expect(result.find((s) => s.type === 'OUTRO')?.startMs).toBe(1330000)
    expect(result[0].submissionCount).toBe(200)
  })
})
