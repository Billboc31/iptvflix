import { describe, it, expect } from 'vitest'
import { normalizeChannelName, toCanonicalDisplayName } from '../channel-normalizer.js'

describe('normalizeChannelName', () => {
  it('strips provider prefix separated by pipe', () => {
    expect(normalizeChannelName('FR | TF1')).toBe('tf1')
  })

  it('strips provider prefix separated by dash', () => {
    expect(normalizeChannelName('FR - TF1')).toBe('tf1')
  })

  it('strips provider prefix with multiple codes', () => {
    expect(normalizeChannelName('FR-HD - TF1')).toBe('tf1')
  })

  it('strips trailing HD suffix', () => {
    expect(normalizeChannelName('TF1 HD')).toBe('tf1')
  })

  it('strips trailing FHD suffix', () => {
    expect(normalizeChannelName('TF1 FHD')).toBe('tf1')
  })

  it('strips trailing 4K suffix', () => {
    expect(normalizeChannelName('TF1 4K')).toBe('tf1')
  })

  it('strips trailing UHD suffix', () => {
    expect(normalizeChannelName('TF1 UHD')).toBe('tf1')
  })

  it('strips HEVC / VIP / RAW tokens', () => {
    expect(normalizeChannelName('TF1 HEVC')).toBe('tf1')
    expect(normalizeChannelName('FR | TF1 VIP')).toBe('tf1')
    expect(normalizeChannelName('TF1 (FHD)')).toBe('tf1')
  })

  it('strips trailing 1080p suffix', () => {
    expect(normalizeChannelName('M6 1080p')).toBe('m6')
  })

  it('strips prefix AND suffix', () => {
    expect(normalizeChannelName('FR | TF1 HD')).toBe('tf1')
  })

  it('strips bracket prefix', () => {
    expect(normalizeChannelName('[FR] TF1')).toBe('tf1')
  })

  it('is a no-op on clean names', () => {
    expect(normalizeChannelName('Arte')).toBe('arte')
  })

  it('handles names with dots', () => {
    expect(normalizeChannelName('M.6')).toBe('m.6')
  })

  it('strips unicode quality badges and hashes', () => {
    expect(normalizeChannelName('FR: LIGUE 1+ ◉ ᴿᴬᵂ')).toBe('ligue 1+')
    expect(normalizeChannelName('##### LIGUE1+ ⱽᴵᴾ ᴴᴰ ######')).toBe('ligue1+')
  })

  it('does not merge different channels by prefix alone', () => {
    expect(normalizeChannelName('FR | Canal+')).toBe('canal+')
    expect(normalizeChannelName('FR | France 2')).toBe('france 2')
    expect(normalizeChannelName('FR | France 2')).not.toBe(normalizeChannelName('FR | France 3'))
  })
})

describe('toCanonicalDisplayName', () => {
  it('title-cases a normalized name', () => {
    expect(toCanonicalDisplayName('tf1')).toBe('Tf1')
  })

  it('title-cases multi-word names', () => {
    expect(toCanonicalDisplayName('france 2')).toBe('France 2')
  })

  it('handles empty string', () => {
    expect(toCanonicalDisplayName('')).toBe('')
  })
})
