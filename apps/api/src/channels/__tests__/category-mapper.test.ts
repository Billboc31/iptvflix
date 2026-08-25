import { describe, it, expect } from 'vitest'
import { mapCategory } from '../category-mapper.js'

describe('mapCategory', () => {
  it('maps sport', () => {
    expect(mapCategory('sport')).toBe('sport')
    expect(mapCategory('Sports')).toBe('sport')
  })

  it('maps news', () => {
    expect(mapCategory('news')).toBe('news')
    expect(mapCategory('Info')).toBe('news')
  })

  it('maps kids', () => {
    expect(mapCategory('kids')).toBe('kids')
    expect(mapCategory('Jeunesse')).toBe('kids')
    expect(mapCategory('Animation')).toBe('kids')
  })

  it('maps cinema', () => {
    expect(mapCategory('cinema')).toBe('cinema')
    expect(mapCategory('Movies')).toBe('cinema')
    expect(mapCategory('VOD')).toBe('cinema')
  })

  it('maps music', () => {
    expect(mapCategory('music')).toBe('music')
    expect(mapCategory('Musique')).toBe('music')
  })

  it('maps documentary', () => {
    expect(mapCategory('documentary')).toBe('documentary')
    expect(mapCategory('Documentaire')).toBe('documentary')
  })

  it('maps entertainment', () => {
    expect(mapCategory('entertainment')).toBe('entertainment')
    expect(mapCategory('Divertissement')).toBe('entertainment')
  })

  it('maps international', () => {
    expect(mapCategory('international')).toBe('international')
    expect(mapCategory('Arabic')).toBe('international')
  })

  it('maps generalist', () => {
    expect(mapCategory('general')).toBe('generalist')
    expect(mapCategory('Généraliste')).toBe('generalist')
  })

  it('preserves unknown values as-is', () => {
    expect(mapCategory('My Custom Group')).toBe('My Custom Group')
  })

  it('case-insensitively matches partial keywords', () => {
    expect(mapCategory('FR Sports HD')).toBe('sport')
    expect(mapCategory('FR News 24')).toBe('news')
  })
})
