import { describe, it, expect } from 'vitest'
import { normalizeTitle } from '../title-normalizer.js'

describe('normalizeTitle', () => {
  it('clean title returns as-is lowercased', () => {
    const result = normalizeTitle('Dune')
    expect(result.normalizedTitle).toBe('dune')
    expect(result.extractedYear).toBeNull()
  })

  it('dot-separated release filename strips noise and extracts year', () => {
    const result = normalizeTitle('Dune.Part.Two.2024.MULTI.1080p')
    expect(result.normalizedTitle).toBe('dune part two')
    expect(result.extractedYear).toBe(2024)
  })

  it('multiple quality and codec tags are stripped', () => {
    const result = normalizeTitle('Oppenheimer.2023.FRENCH.BluRay.4K.x265.DTS.HDMA')
    expect(result.normalizedTitle).toBe('oppenheimer')
    expect(result.extractedYear).toBe(2023)
  })

  it('accented characters in title are preserved', () => {
    const result = normalizeTitle('Astérix.et.Obélix.Mission.Cléopâtre.2002.BluRay')
    expect(result.normalizedTitle).toContain('astérix')
    expect(result.normalizedTitle).toContain('cléopâtre')
    expect(result.extractedYear).toBe(2002)
  })

  it('parenthetical year is extracted and parens are cleaned', () => {
    const result = normalizeTitle('Blade Runner 2049 (2017) 4K HDR')
    expect(result.normalizedTitle).toBe('blade runner 2049')
    expect(result.extractedYear).toBe(2017)
  })

  it('episode identifier is stripped, no year extracted', () => {
    const result = normalizeTitle('Breaking Bad S01E01 1080p')
    expect(result.normalizedTitle).toBe('breaking bad')
    expect(result.extractedYear).toBeNull()
  })

  it('year at start with no release tags is treated as title content', () => {
    const result = normalizeTitle('2001 A Space Odyssey')
    expect(result.normalizedTitle).toBe('2001 a space odyssey')
    expect(result.extractedYear).toBeNull()
  })

  it('produces no leading or trailing brackets or hyphens', () => {
    const cases = [
      '[Movie Name 2020 1080p]',
      '(Movie.Title.2019.BluRay)',
    ]
    for (const input of cases) {
      const { normalizedTitle } = normalizeTitle(input)
      expect(normalizedTitle).not.toMatch(/^[\[\](){}]|[\[\](){}]$/)
      expect(normalizedTitle).not.toMatch(/^-|-$/)
    }
  })
})
