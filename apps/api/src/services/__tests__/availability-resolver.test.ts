import { describe, it, expect } from 'vitest'
import { resolveVariant } from '../availability-resolver.js'
import type { ResolvableVariant } from '../availability-resolver.js'
import type { ProfilePreferences } from '@iptvflix/api-contracts'

const EMPTY_PREFS: ProfilePreferences = {
  preferredAudioLanguages: [],
  preferredSubtitleLanguages: [],
  preferredSourceIds: [],
  maxVideoQuality: null,
}

function makeVariant(overrides: Partial<ResolvableVariant> & { id: string }): ResolvableVariant {
  return {
    status: 'AVAILABLE',
    providerId: 'provider-a',
    audioLanguage: null,
    subtitleLanguage: null,
    videoQuality: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// No availability
// ---------------------------------------------------------------------------
describe('no available variants', () => {
  it('returns null selectedVariantId when all variants are UNAVAILABLE', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'UNAVAILABLE' }),
      makeVariant({ id: 'v2', status: 'UNAVAILABLE' }),
    ]
    const result = resolveVariant(variants, EMPTY_PREFS)
    expect(result.selectedVariantId).toBeNull()
    expect(result.alternativeVariantIds).toEqual([])
    expect(result.reason).toBe('no_available_variant')
  })

  it('returns null when variants array is empty', () => {
    const result = resolveVariant([], EMPTY_PREFS)
    expect(result.selectedVariantId).toBeNull()
    expect(result.reason).toBe('no_available_variant')
  })
})

// ---------------------------------------------------------------------------
// UNAVAILABLE variants cannot be selected
// ---------------------------------------------------------------------------
describe('UNAVAILABLE variants are excluded', () => {
  it('selects the AVAILABLE variant when another is UNAVAILABLE', () => {
    const variants = [
      makeVariant({ id: 'v1', status: 'UNAVAILABLE', videoQuality: '4K' }),
      makeVariant({ id: 'v2', status: 'AVAILABLE', videoQuality: '720p' }),
    ]
    const result = resolveVariant(variants, EMPTY_PREFS)
    expect(result.selectedVariantId).toBe('v2')
  })
})

// ---------------------------------------------------------------------------
// Audio language preference
// ---------------------------------------------------------------------------
describe('audio language preference', () => {
  it('selects en-audio over fr-audio when prefs are ["en"]', () => {
    const variants = [
      makeVariant({ id: 'v-fr', audioLanguage: 'fr', videoQuality: '1080p' }),
      makeVariant({ id: 'v-en', audioLanguage: 'en', videoQuality: '720p' }),
    ]
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, preferredAudioLanguages: ['en'] }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v-en')
  })

  it('selects fr-audio over en-audio when prefs are ["fr","en"]', () => {
    const variants = [
      makeVariant({ id: 'v-en', audioLanguage: 'en', videoQuality: '4K' }),
      makeVariant({ id: 'v-fr', audioLanguage: 'fr', videoQuality: '480p' }),
    ]
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, preferredAudioLanguages: ['fr', 'en'] }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v-fr')
  })

  it('selects en-audio over fr-audio when prefs are ["en","fr"]', () => {
    const variants = [
      makeVariant({ id: 'v-fr', audioLanguage: 'fr', videoQuality: '4K' }),
      makeVariant({ id: 'v-en', audioLanguage: 'en', videoQuality: '480p' }),
    ]
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, preferredAudioLanguages: ['en', 'fr'] }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v-en')
  })
})

// ---------------------------------------------------------------------------
// Subtitle as tiebreaker
// ---------------------------------------------------------------------------
describe('subtitle language as tiebreaker', () => {
  it('uses subtitle match to break audio tie', () => {
    const variants = [
      makeVariant({ id: 'v1', audioLanguage: 'en', subtitleLanguage: null }),
      makeVariant({ id: 'v2', audioLanguage: 'en', subtitleLanguage: 'fr' }),
    ]
    const prefs: ProfilePreferences = {
      ...EMPTY_PREFS,
      preferredAudioLanguages: ['en'],
      preferredSubtitleLanguages: ['fr'],
    }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v2')
  })
})

// ---------------------------------------------------------------------------
// Source priority overrides quality
// ---------------------------------------------------------------------------
describe('source priority overrides quality', () => {
  it('preferred-source 720p beats non-preferred-source 1080p when audio scores are equal', () => {
    const variants = [
      makeVariant({ id: 'v-hq', providerId: 'provider-b', videoQuality: '1080p' }),
      makeVariant({ id: 'v-pref', providerId: 'provider-a', videoQuality: '720p' }),
    ]
    const prefs: ProfilePreferences = {
      ...EMPTY_PREFS,
      preferredSourceIds: ['provider-a'],
    }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v-pref')
  })
})

// ---------------------------------------------------------------------------
// Quality ranking within cap
// ---------------------------------------------------------------------------
describe('maxVideoQuality cap', () => {
  it('4K variant scored at 1080p cap when maxVideoQuality is 1080p', () => {
    const variants = [
      makeVariant({ id: 'v-4k', videoQuality: '4K' }),
      makeVariant({ id: 'v-1080', videoQuality: '1080p' }),
    ]
    // With cap at 1080p, 4K is scored as 1080p. Tiebreak by id ascending: v-1080 < v-4k alphabetically.
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, maxVideoQuality: '1080p' }
    const result = resolveVariant(variants, prefs)
    // Both score equally after cap; tiebreak: 'v-1080' < 'v-4k'
    expect(result.selectedVariantId).toBe('v-1080')
    // 4K is NOT excluded — it's still in alternatives
    expect(result.alternativeVariantIds).toContain('v-4k')
  })

  it('4K variant is not excluded, only capped', () => {
    const variants = [
      makeVariant({ id: 'v-4k', videoQuality: '4K' }),
      makeVariant({ id: 'v-480', videoQuality: '480p' }),
    ]
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, maxVideoQuality: '1080p' }
    const result = resolveVariant(variants, prefs)
    // 4K scored at cap (1080p rank=2) vs 480p (rank=0) — 4K wins
    expect(result.selectedVariantId).toBe('v-4k')
    expect(result.alternativeVariantIds).toContain('v-480')
  })
})

// ---------------------------------------------------------------------------
// Unknown/null audio treated as fallback
// ---------------------------------------------------------------------------
describe('unknown metadata is not silently dropped', () => {
  it('null-audio variant appears in alternativeVariantIds, not selectedVariantId, when audio pref is set', () => {
    const variants = [
      makeVariant({ id: 'v-known', audioLanguage: 'en' }),
      makeVariant({ id: 'v-null', audioLanguage: null }),
    ]
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, preferredAudioLanguages: ['en'] }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v-known')
    expect(result.alternativeVariantIds).toContain('v-null')
  })

  it('null-audio variant is AVAILABLE and returned as selected when it is the only candidate', () => {
    const variants = [makeVariant({ id: 'v-null', audioLanguage: null })]
    const prefs: ProfilePreferences = { ...EMPTY_PREFS, preferredAudioLanguages: ['en'] }
    const result = resolveVariant(variants, prefs)
    expect(result.selectedVariantId).toBe('v-null')
  })
})

// ---------------------------------------------------------------------------
// Tie-break determinism
// ---------------------------------------------------------------------------
describe('tie-break determinism', () => {
  it('lower UUID wins consistently when all scores are equal', () => {
    const variants = [
      makeVariant({ id: 'z0000000-0000-0000-0000-000000000002', videoQuality: '720p' }),
      makeVariant({ id: 'a0000000-0000-0000-0000-000000000001', videoQuality: '720p' }),
    ]
    const result = resolveVariant(variants, EMPTY_PREFS)
    expect(result.selectedVariantId).toBe('a0000000-0000-0000-0000-000000000001')
  })

  it('result is stable regardless of input order', () => {
    const v1 = makeVariant({ id: 'a0000000-0000-0000-0000-000000000001', videoQuality: '720p' })
    const v2 = makeVariant({ id: 'z0000000-0000-0000-0000-000000000002', videoQuality: '720p' })

    const r1 = resolveVariant([v1, v2], EMPTY_PREFS)
    const r2 = resolveVariant([v2, v1], EMPTY_PREFS)

    expect(r1.selectedVariantId).toBe(r2.selectedVariantId)
  })
})

// ---------------------------------------------------------------------------
// Quality ranking without cap
// ---------------------------------------------------------------------------
describe('quality ranking (no cap)', () => {
  it('4K beats 1080p beats 720p beats 480p with empty preferences', () => {
    const variants = [
      makeVariant({ id: 'v-480', videoQuality: '480p' }),
      makeVariant({ id: 'v-4k', videoQuality: '4K' }),
      makeVariant({ id: 'v-720', videoQuality: '720p' }),
      makeVariant({ id: 'v-1080', videoQuality: '1080p' }),
    ]
    const result = resolveVariant(variants, EMPTY_PREFS)
    expect(result.selectedVariantId).toBe('v-4k')
    expect(result.alternativeVariantIds).toEqual(['v-1080', 'v-720', 'v-480'])
  })

  it('null quality is lowest priority', () => {
    const variants = [
      makeVariant({ id: 'v-null', videoQuality: null }),
      makeVariant({ id: 'v-480', videoQuality: '480p' }),
    ]
    const result = resolveVariant(variants, EMPTY_PREFS)
    expect(result.selectedVariantId).toBe('v-480')
    expect(result.alternativeVariantIds).toContain('v-null')
  })
})
