import { describe, expect, it } from 'vitest'
import { resolveMediaImageUrl } from '../tmdb-image.js'

describe('resolveMediaImageUrl', () => {
  it('returns null for empty values', () => {
    expect(resolveMediaImageUrl(null)).toBeNull()
    expect(resolveMediaImageUrl(undefined)).toBeNull()
    expect(resolveMediaImageUrl('')).toBeNull()
    expect(resolveMediaImageUrl('   ')).toBeNull()
  })

  it('prefixes TMDB relative paths', () => {
    expect(resolveMediaImageUrl('/abc.jpg')).toBe('https://image.tmdb.org/t/p/w500/abc.jpg')
    expect(resolveMediaImageUrl('abc.jpg', 'w780')).toBe('https://image.tmdb.org/t/p/w780/abc.jpg')
  })

  it('keeps absolute http(s) URLs unchanged', () => {
    const url = 'https://cdn.example.com/cover.jpg'
    expect(resolveMediaImageUrl(url)).toBe(url)
  })
})
