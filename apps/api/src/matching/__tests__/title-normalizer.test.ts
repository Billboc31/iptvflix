import { describe, it, expect } from 'vitest'
import { normalizeTitle, toCanonicalDisplayTitle } from '../title-normalizer.js'

describe('normalizeTitle', () => {
  it('clean title returns as-is lowercased', () => {
    const result = normalizeTitle('Dune')
    expect(result.normalizedTitle).toBe('dune')
    expect(result.extractedYear).toBeNull()
    expect(result.variantAttributes).toBeDefined()
    expect(result.variantAttributes).toEqual({
      audioLanguage: null,
      subtitleLanguage: null,
      videoQuality: null,
      codecName: null,
      hdrFormat: null,
      releaseHint: null,
      audioFormat: null,
    })
  })

  it('dot-separated release filename strips noise and extracts year', () => {
    const result = normalizeTitle('Dune.Part.Two.2024.MULTI.1080p')
    expect(result.normalizedTitle).toBe('dune part two')
    expect(result.extractedYear).toBe(2024)
    expect(result.variantAttributes.audioLanguage).toBeNull()
    expect(result.variantAttributes.videoQuality).toBe('1080p')
  })

  it('multiple quality and codec tags are stripped', () => {
    const result = normalizeTitle('Oppenheimer.2023.FRENCH.BluRay.4K.x265.DTS.HDMA')
    expect(result.normalizedTitle).toBe('oppenheimer')
    expect(result.extractedYear).toBe(2023)
    expect(result.variantAttributes.audioLanguage).toBe('fr')
    expect(result.variantAttributes.videoQuality).toBe('4K')
  })

  it('accented characters in title are preserved', () => {
    const result = normalizeTitle('Astérix.et.Obélix.Mission.Cléopâtre.2002.BluRay')
    expect(result.normalizedTitle).toContain('astérix')
    expect(result.normalizedTitle).toContain('cléopâtre')
    expect(result.extractedYear).toBe(2002)
    expect(result.variantAttributes).toBeDefined()
  })

  it('parenthetical year is extracted and parens are cleaned', () => {
    const result = normalizeTitle('Blade Runner 2049 (2017) 4K HDR')
    expect(result.normalizedTitle).toBe('blade runner 2049')
    expect(result.extractedYear).toBe(2017)
    expect(result.variantAttributes.videoQuality).toBe('4K')
  })

  it('episode identifier is stripped, no year extracted', () => {
    const result = normalizeTitle('Breaking Bad S01E01 1080p')
    expect(result.normalizedTitle).toBe('breaking bad')
    expect(result.extractedYear).toBeNull()
    expect(result.variantAttributes.videoQuality).toBe('1080p')
  })

  it('year at start with no release tags is treated as title content', () => {
    const result = normalizeTitle('2001 A Space Odyssey')
    expect(result.normalizedTitle).toBe('2001 a space odyssey')
    expect(result.extractedYear).toBeNull()
    expect(result.variantAttributes).toEqual({
      audioLanguage: null,
      subtitleLanguage: null,
      videoQuality: null,
      codecName: null,
      hdrFormat: null,
      releaseHint: null,
      audioFormat: null,
    })
  })

  it('produces no leading or trailing brackets or hyphens', () => {
    const cases = [
      '[Movie Name 2020 1080p]',
      '(Movie.Title.2019.BluRay)',
    ]
    for (const input of cases) {
      const { normalizedTitle, variantAttributes } = normalizeTitle(input)
      expect(normalizedTitle).not.toMatch(/^[\[\](){}]|[\[\](){}]$/)
      expect(normalizedTitle).not.toMatch(/^-|-$/)
      expect(variantAttributes).toBeDefined()
    }
  })

  it('VOSTFR title produces subtitleLanguage fr and audioLanguage null', () => {
    const result = normalizeTitle('Film.VOSTFR.4K')
    expect(result.variantAttributes.audioLanguage).toBeNull()
    expect(result.variantAttributes.subtitleLanguage).toBe('fr')
    expect(result.variantAttributes.videoQuality).toBe('4K')
  })

  it('strips IPTV channel prefixes so variants consolidate on the same key', () => {
    const a = normalizeTitle('4K-FR - Dune Part Two 2024 1080p')
    const b = normalizeTitle('MULTI - Dune Part Two (2024)')
    const c = normalizeTitle('Dune.Part.Two.2024.MULTi.1080p')
    expect(a.normalizedTitle).toBe('dune part two')
    expect(b.normalizedTitle).toBe('dune part two')
    expect(c.normalizedTitle).toBe('dune part two')
    expect(a.extractedYear).toBe(2024)
  })

  it('does not strip real title fragments before a hyphen', () => {
    const result = normalizeTitle('Spider-Man - No Way Home (2021)')
    expect(result.normalizedTitle).toBe('spider-man no way home')
    expect(result.extractedYear).toBe(2021)
  })

  it('toCanonicalDisplayTitle returns a clean title-cased label', () => {
    expect(toCanonicalDisplayTitle('4K-FR - Dune Part Two 2024 1080p')).toBe('Dune Part Two')
  })
})
