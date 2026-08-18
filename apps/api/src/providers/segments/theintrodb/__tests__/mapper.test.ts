import { describe, it, expect } from 'vitest'
import { mapTheIntroDbResponse } from '../mapper.js'
import type { TheIntroDbResponse } from '../types.js'

const EPISODE_ID = 'ep-uuid-theintrodb-001'

describe('mapTheIntroDbResponse()', () => {
  it('maps all four segment types correctly', () => {
    const raw: TheIntroDbResponse = {
      intro: [{ start: 60, end: 120, submissions: 10 }],
      recap: [{ start: 0, end: 45, submissions: 5 }],
      credits: [{ start: 1380, end: 1440, submissions: 8 }],
      preview: [{ start: 1440, end: 1500, submissions: 3 }],
    }
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result).toHaveLength(4)
    expect(result.map((s) => s.type).sort()).toEqual(['CREDITS', 'INTRO', 'PREVIEW', 'RECAP'])

    const intro = result.find((s) => s.type === 'INTRO')!
    expect(intro.sourceProvider).toBe('theintrodb')
    expect(intro.startMs).toBe(60000)
    expect(intro.endMs).toBe(120000)

    const recap = result.find((s) => s.type === 'RECAP')!
    expect(recap.startMs).toBe(0)
    expect(recap.endMs).toBe(45000)

    const credits = result.find((s) => s.type === 'CREDITS')!
    expect(credits.startMs).toBe(1380000)
    expect(credits.endMs).toBe(1440000)
  })

  it('converts seconds to milliseconds', () => {
    const raw: TheIntroDbResponse = { intro: [{ start: 1.5, end: 2.9 }] }
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].startMs).toBe(1500)
    expect(result[0].endMs).toBe(2900)
  })

  it('picks the entry with the highest submissions from an array', () => {
    const raw: TheIntroDbResponse = {
      intro: [
        { start: 60, end: 120, submissions: 5 },
        { start: 62, end: 122, submissions: 20 },
        { start: 61, end: 121, submissions: 3 },
      ],
    }
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result).toHaveLength(1)
    expect(result[0].startMs).toBe(62000)
    expect(result[0].submissionCount).toBe(20)
  })

  it('uses first entry when submissions are tied', () => {
    const raw: TheIntroDbResponse = {
      intro: [
        { start: 60, end: 120 },
        { start: 62, end: 122 },
      ],
    }
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].startMs).toBe(60000)
  })

  it('sets confidence to 1.0 when verified is true', () => {
    const raw: TheIntroDbResponse = {
      intro: [{ start: 60, end: 120, verified: true, submissions: 5 }],
    }
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].confidence).toBe(1.0)
  })

  it('leaves confidence undefined when verified is false or absent', () => {
    const raw: TheIntroDbResponse = {
      intro: [{ start: 60, end: 120, verified: false }],
    }
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result[0].confidence).toBeUndefined()
  })

  it('skips entries with null/non-numeric start or end', () => {
    const raw = {
      intro: [
        { start: null, end: 120 },
        { start: 60, end: 120 },
      ],
    } as unknown as TheIntroDbResponse
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result).toHaveLength(1)
    expect(result[0].startMs).toBe(60000)
  })

  it('logs warning and skips unknown segment type keys', () => {
    const raw = {
      intro: [{ start: 60, end: 120 }],
      unknownType: [{ start: 200, end: 300 }],
    } as unknown as TheIntroDbResponse
    const result = mapTheIntroDbResponse(raw, EPISODE_ID)
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('INTRO')
  })

  it('returns empty array when response is empty', () => {
    const result = mapTheIntroDbResponse({}, EPISODE_ID)
    expect(result).toEqual([])
  })

  it('maps anime fixture (Attack on Titan S1E1 — known intro)', () => {
    const raw: TheIntroDbResponse = {
      intro: [{ start: 95, end: 185, submissions: 150, verified: true }],
      recap: [{ start: 0, end: 90, submissions: 80 }],
    }
    const result = mapTheIntroDbResponse(raw, 'aot-s1e1')
    expect(result).toHaveLength(2)
    const intro = result.find((s) => s.type === 'INTRO')!
    expect(intro.startMs).toBe(95000)
    expect(intro.endMs).toBe(185000)
    expect(intro.submissionCount).toBe(150)
    expect(intro.confidence).toBe(1.0)
  })
})
