import { describe, it, expect } from 'vitest'
import { inferChannelLanguage } from '../language-infer.js'

describe('inferChannelLanguage', () => {
  it('detects FR| prefix on group title', () => {
    expect(inferChannelLanguage('TF1', 'FR| FRANCE VIP')).toBe('fr')
  })

  it('detects EN prefix on name', () => {
    expect(inferChannelLanguage('EN| BBC One', null)).toBe('en')
  })

  it('detects arabic keywords', () => {
    expect(inferChannelLanguage('Al Jazeera', 'Arabic')).toBe('ar')
  })

  it('returns null when unknown', () => {
    expect(inferChannelLanguage('Mystery Channel', 'Misc')).toBeNull()
  })
})
