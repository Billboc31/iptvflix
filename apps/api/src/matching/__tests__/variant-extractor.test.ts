import { describe, it, expect } from 'vitest'
import { extractVariantAttributes } from '../variant-extractor.js'

describe('extractVariantAttributes', () => {
  // Audio language — French
  it('FRENCH → audioLanguage fr', () => {
    const result = extractVariantAttributes('Dune.FRENCH.BluRay')
    expect(result).toEqual({ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: null })
  })

  it('TRUEFRENCH → audioLanguage fr, never subtitleLanguage fr', () => {
    const result = extractVariantAttributes('Film.TRUEFRENCH')
    expect(result).toEqual({ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: null })
  })

  it('VFF → audioLanguage fr', () => {
    const result = extractVariantAttributes('Movie.VFF.1080p')
    expect(result.audioLanguage).toBe('fr')
  })

  it('VF → audioLanguage fr', () => {
    const result = extractVariantAttributes('Film.VF.720p')
    expect(result.audioLanguage).toBe('fr')
  })

  // Audio language — English
  it('ENG → audioLanguage en', () => {
    const result = extractVariantAttributes('Movie.ENG.1080p')
    expect(result).toEqual({ audioLanguage: 'en', subtitleLanguage: null, videoQuality: '1080p' })
  })

  // Subtitles — VOSTFR
  it('VOSTFR → audioLanguage null, subtitleLanguage fr', () => {
    const result = extractVariantAttributes('Avatar.VOSTFR')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: 'fr', videoQuality: null })
  })

  it('VOSTFR does not produce French audio', () => {
    const result = extractVariantAttributes('Film.VOSTFR.1080p')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBe('fr')
  })

  // Ambiguous / null audio
  it('MULTI → all null', () => {
    const result = extractVariantAttributes('Movie.MULTI.4K')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBeNull()
  })

  it('MULTi → all null audio', () => {
    const result = extractVariantAttributes('Movie.MULTi.1080p')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBeNull()
  })

  it('VO → audioLanguage null', () => {
    const result = extractVariantAttributes('Film.VO')
    expect(result.audioLanguage).toBeNull()
  })

  it('VOST → subtitleLanguage null', () => {
    const result = extractVariantAttributes('Film.VOST')
    expect(result.subtitleLanguage).toBeNull()
  })

  it('VOFF → all null', () => {
    const result = extractVariantAttributes('Film.VOFF.720p')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBeNull()
  })

  // Video quality
  it('1080p → videoQuality 1080p', () => {
    const result = extractVariantAttributes('Movie.1080p')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: null, videoQuality: '1080p' })
  })

  it('2160p → videoQuality 4K', () => {
    const result = extractVariantAttributes('Movie.2160p.HDR')
    expect(result.videoQuality).toBe('4K')
  })

  it('4K → videoQuality 4K', () => {
    const result = extractVariantAttributes('Movie.4K')
    expect(result.videoQuality).toBe('4K')
  })

  it('UHD → videoQuality 4K', () => {
    const result = extractVariantAttributes('Movie.UHD.BluRay')
    expect(result.videoQuality).toBe('4K')
  })

  it('720p → videoQuality 720p', () => {
    const result = extractVariantAttributes('Movie.720p')
    expect(result.videoQuality).toBe('720p')
  })

  it('480p → videoQuality 480p', () => {
    const result = extractVariantAttributes('Movie.480p')
    expect(result.videoQuality).toBe('480p')
  })

  it('HD → videoQuality null', () => {
    const result = extractVariantAttributes('Movie.HD')
    expect(result.videoQuality).toBeNull()
  })

  it('SD → videoQuality null', () => {
    const result = extractVariantAttributes('Movie.SD')
    expect(result.videoQuality).toBeNull()
  })

  // Combinations
  it('TRUEFRENCH.1080p → fr audio, 1080p quality', () => {
    const result = extractVariantAttributes('Dune.TRUEFRENCH.1080p')
    expect(result).toEqual({ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: '1080p' })
  })

  it('VOSTFR.4K.HDR → null audio, fr subtitle, 4K quality', () => {
    const result = extractVariantAttributes('Avatar.VOSTFR.4K.HDR')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: 'fr', videoQuality: '4K' })
  })

  it('MULTI.2160p → null audio, 4K quality', () => {
    const result = extractVariantAttributes('Movie.MULTI.2160p')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: null, videoQuality: '4K' })
  })

  // Unknown / no tag
  it('no recognizable tag → all null', () => {
    const result = extractVariantAttributes('Interstellar')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: null, videoQuality: null })
  })

  it('ambiguous tags produce null, never guessed value', () => {
    const result = extractVariantAttributes('Some.Random.Movie.x265')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: null, videoQuality: null })
  })
})
