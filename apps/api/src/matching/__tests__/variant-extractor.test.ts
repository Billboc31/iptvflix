import { describe, it, expect } from 'vitest'
import { extractVariantAttributes } from '../variant-extractor.js'

const EMPTY = { codecName: null, hdrFormat: null, releaseHint: null, audioFormat: null }

describe('extractVariantAttributes', () => {
  // Audio language — French
  it('FRENCH → audioLanguage fr', () => {
    const result = extractVariantAttributes('Dune.FRENCH.BluRay')
    expect(result).toEqual({
      audioLanguage: 'fr',
      subtitleLanguage: null,
      videoQuality: null,
      ...EMPTY,
      releaseHint: 'Blu-ray',
    })
  })

  it('TRUEFRENCH → audioLanguage fr, never subtitleLanguage fr', () => {
    const result = extractVariantAttributes('Film.TRUEFRENCH')
    expect(result).toEqual({ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: null, ...EMPTY })
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
    expect(result).toEqual({ audioLanguage: 'en', subtitleLanguage: null, videoQuality: '1080p', ...EMPTY })
  })

  // Subtitles — VOSTFR
  it('VOSTFR → audioLanguage null, subtitleLanguage fr', () => {
    const result = extractVariantAttributes('Avatar.VOSTFR')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: 'fr', videoQuality: null, ...EMPTY })
  })

  it('VOSTFR does not produce French audio', () => {
    const result = extractVariantAttributes('Film.VOSTFR.1080p')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBe('fr')
  })

  // Ambiguous / null audio
  it('MULTI → audioLanguage null, subtitleLanguage null, audioFormat MULTI', () => {
    const result = extractVariantAttributes('Movie.MULTI.4K')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBeNull()
    expect(result.audioFormat).toBe('MULTI')
  })

  it('MULTi → audioLanguage null, subtitleLanguage null, audioFormat MULTI', () => {
    const result = extractVariantAttributes('Movie.MULTi.1080p')
    expect(result.audioLanguage).toBeNull()
    expect(result.subtitleLanguage).toBeNull()
    expect(result.audioFormat).toBe('MULTI')
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
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: null, videoQuality: '1080p', ...EMPTY })
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
    expect(result).toEqual({ audioLanguage: 'fr', subtitleLanguage: null, videoQuality: '1080p', ...EMPTY })
  })

  it('VOSTFR.4K.HDR → null audio, fr subtitle, 4K quality, HDR format', () => {
    const result = extractVariantAttributes('Avatar.VOSTFR.4K.HDR')
    expect(result).toEqual({
      audioLanguage: null,
      subtitleLanguage: 'fr',
      videoQuality: '4K',
      codecName: null,
      hdrFormat: 'HDR',
      releaseHint: null,
      audioFormat: null,
    })
  })

  it('MULTI.2160p → null audio, 4K quality, audioFormat MULTI', () => {
    const result = extractVariantAttributes('Movie.MULTI.2160p')
    expect(result).toEqual({
      audioLanguage: null,
      subtitleLanguage: null,
      videoQuality: '4K',
      codecName: null,
      hdrFormat: null,
      releaseHint: null,
      audioFormat: 'MULTI',
    })
  })

  // Unknown / no tag
  it('no recognizable tag → all null', () => {
    const result = extractVariantAttributes('Interstellar')
    expect(result).toEqual({ audioLanguage: null, subtitleLanguage: null, videoQuality: null, ...EMPTY })
  })

  it('x265 → codecName H.265, other fields null', () => {
    const result = extractVariantAttributes('Some.Random.Movie.x265')
    expect(result).toEqual({
      audioLanguage: null,
      subtitleLanguage: null,
      videoQuality: null,
      codecName: 'H.265',
      hdrFormat: null,
      releaseHint: null,
      audioFormat: null,
    })
  })

  // Codec detection
  it('HEVC → codecName H.265', () => {
    expect(extractVariantAttributes('Movie.HEVC.1080p').codecName).toBe('H.265')
  })

  it('x264 → codecName H.264', () => {
    expect(extractVariantAttributes('Movie.x264.720p').codecName).toBe('H.264')
  })

  it('AVC → codecName H.264', () => {
    expect(extractVariantAttributes('Movie.AVC').codecName).toBe('H.264')
  })

  // HDR detection
  it('HDR10 → hdrFormat HDR10', () => {
    expect(extractVariantAttributes('Movie.HDR10.4K').hdrFormat).toBe('HDR10')
  })

  it('HDR → hdrFormat HDR (not HDR10)', () => {
    expect(extractVariantAttributes('Movie.HDR.1080p').hdrFormat).toBe('HDR')
  })

  it('DV → hdrFormat Dolby Vision', () => {
    expect(extractVariantAttributes('Movie.DV.4K').hdrFormat).toBe('Dolby Vision')
  })

  it('HLG → hdrFormat HLG', () => {
    expect(extractVariantAttributes('Movie.HLG').hdrFormat).toBe('HLG')
  })

  // Release hint detection
  it('BluRay → releaseHint Blu-ray', () => {
    expect(extractVariantAttributes('Dune.FRENCH.BluRay').releaseHint).toBe('Blu-ray')
  })

  it('WEB-DL → releaseHint WEB-DL', () => {
    expect(extractVariantAttributes('Movie.WEB-DL.1080p').releaseHint).toBe('WEB-DL')
  })

  it('WEBRip → releaseHint WEBRip', () => {
    expect(extractVariantAttributes('Movie.WEBRip').releaseHint).toBe('WEBRip')
  })

  it('HDTV → releaseHint HDTV', () => {
    expect(extractVariantAttributes('Movie.HDTV.720p').releaseHint).toBe('HDTV')
  })

  // Audio format detection
  it('DTS → audioFormat DTS', () => {
    expect(extractVariantAttributes('Movie.DTS.1080p').audioFormat).toBe('DTS')
  })

  it('Atmos → audioFormat Atmos', () => {
    expect(extractVariantAttributes('Movie.Atmos.4K').audioFormat).toBe('Atmos')
  })

  it('TrueHD → audioFormat TrueHD', () => {
    expect(extractVariantAttributes('Movie.TrueHD').audioFormat).toBe('TrueHD')
  })

  it('5.1 → audioFormat 5.1', () => {
    expect(extractVariantAttributes('Movie.5.1.720p').audioFormat).toBe('5.1')
  })

  // Ticket examples (T093)
  it('4K-FR - Dune (2021) → fr audio, 4K quality', () => {
    const result = extractVariantAttributes('4K-FR - Dune (2021)')
    expect(result.audioLanguage).toBe('fr')
    expect(result.videoQuality).toBe('4K')
  })

  it('DUNE.MULTI.1080P.BluRay → MULTI audioFormat, 1080p quality, Blu-ray hint', () => {
    const result = extractVariantAttributes('DUNE.MULTI.1080P.BluRay')
    expect(result.audioFormat).toBe('MULTI')
    expect(result.videoQuality).toBe('1080p')
    expect(result.releaseHint).toBe('Blu-ray')
  })

  it('Dune VOSTFR 720p → VOSTFR (fr subtitle), 720p quality', () => {
    const result = extractVariantAttributes('Dune VOSTFR 720p')
    expect(result.subtitleLanguage).toBe('fr')
    expect(result.audioLanguage).toBeNull()
    expect(result.videoQuality).toBe('720p')
  })
})
