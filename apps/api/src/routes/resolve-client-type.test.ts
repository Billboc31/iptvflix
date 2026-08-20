import { describe, it, expect } from 'vitest'
import { resolveClientType } from './resolve-client-type.js'

function mockRequest(overrides: {
  body?: { clientType?: string }
  query?: { clientType?: string }
  headers?: Record<string, string | undefined>
}) {
  return {
    body: overrides.body,
    query: overrides.query ?? {},
    headers: overrides.headers ?? {},
  } as Parameters<typeof resolveClientType>[0]
}

describe('resolveClientType', () => {
  it('prefers body clientType', () => {
    expect(resolveClientType(mockRequest({
      body: { clientType: 'android-tv' },
      query: { clientType: 'web' },
      headers: { 'x-client-type': 'web' },
    }))).toBe('android-tv')
  })

  it('falls back to query param', () => {
    expect(resolveClientType(mockRequest({
      query: { clientType: 'android-tv' },
    }))).toBe('android-tv')
  })

  it('falls back to X-Client-Type header', () => {
    expect(resolveClientType(mockRequest({
      headers: { 'x-client-type': 'android-tv' },
    }))).toBe('android-tv')
  })

  it('detects Android TV user agent', () => {
    expect(resolveClientType(mockRequest({
      headers: { 'user-agent': 'IPTVFlix-AndroidTV/0.0.2' },
    }))).toBe('android-tv')
  })

  it('returns undefined for web clients', () => {
    expect(resolveClientType(mockRequest({
      headers: { 'user-agent': 'Mozilla/5.0 Chrome/120' },
    }))).toBeUndefined()
  })
})
