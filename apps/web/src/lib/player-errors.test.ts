import { describe, expect, it } from 'vitest'
import { isHlsContainer, isMpegTsContainer, videoErrorMessage } from './player-errors.js'

describe('videoErrorMessage', () => {
  it('maps gateway HTTP errors before browser decode errors', () => {
    expect(videoErrorMessage(null, 502)).toBe('Le fournisseur a refusé le flux')
    expect(videoErrorMessage(null, 404)).toMatch(/introuvable/i)
    expect(videoErrorMessage(null, 504)).toMatch(/répond pas/i)
    expect(videoErrorMessage(null, 410)).toMatch(/conversion vidéo/i)
  })
})

describe('container helpers', () => {
  it('detects mpeg-ts and hls extensions', () => {
    expect(isMpegTsContainer('ts')).toBe(true)
    expect(isMpegTsContainer('mp4')).toBe(false)
    expect(isHlsContainer('m3u8')).toBe(true)
  })
})
