import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Must mock env before importing the cursor module.
vi.mock('../../config/env.js', () => ({
  HOME_CURSOR_SECRET: 'test-secret-for-unit-tests',
}))

import { signCursor, verifyCursor } from '../home-cursor.js'

const SESSION_ID = '00000000-0000-0000-0000-000000000001'

describe('signCursor / verifyCursor', () => {
  it('round-trips a valid cursor', () => {
    const token = signCursor(SESSION_ID, 6)
    const result = verifyCursor(token)
    expect(result).not.toBeNull()
    expect(result!.sessionId).toBe(SESSION_ID)
    expect(result!.nextPosition).toBe(6)
  })

  it('returns null for a tampered payload', () => {
    const token = signCursor(SESSION_ID, 0)
    const [payload, sig] = token.split('.')
    // Flip one char in the payload.
    const tampered = payload.slice(0, -1) + (payload.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyCursor(`${tampered}.${sig}`)).toBeNull()
  })

  it('returns null for a tampered signature', () => {
    const token = signCursor(SESSION_ID, 0)
    const [payload, sig] = token.split('.')
    const tamperedSig = sig.slice(0, -1) + (sig.at(-1) === 'a' ? 'b' : 'a')
    expect(verifyCursor(`${payload}.${tamperedSig}`)).toBeNull()
  })

  it('returns null for garbage input', () => {
    expect(verifyCursor('')).toBeNull()
    expect(verifyCursor('notavalidtoken')).toBeNull()
    expect(verifyCursor('a.b.c')).toBeNull()
  })

  it('returns null for an expired cursor (> 48 h old)', () => {
    const FORTY_NINE_HOURS = 49 * 60 * 60 * 1000
    vi.useFakeTimers()
    const token = signCursor(SESSION_ID, 3)
    vi.advanceTimersByTime(FORTY_NINE_HOURS)
    expect(verifyCursor(token)).toBeNull()
    vi.useRealTimers()
  })

  it('returns a valid result for a cursor just under 48 h old', () => {
    const FORTY_SEVEN_HOURS = 47 * 60 * 60 * 1000
    vi.useFakeTimers()
    const token = signCursor(SESSION_ID, 12)
    vi.advanceTimersByTime(FORTY_SEVEN_HOURS)
    const result = verifyCursor(token)
    expect(result).not.toBeNull()
    expect(result!.nextPosition).toBe(12)
    vi.useRealTimers()
  })
})

describe('secret isolation', () => {
  it('returns null when verified with a different secret (simulated by tampered sig)', () => {
    // Without re-importing with a different secret mock, we verify that
    // signing with secret A and verifying with secret B fails.
    // We test this indirectly: a token signed by signCursor uses the mock secret;
    // manually building a token with a different HMAC key yields a wrong sig.
    const { createHmac } = require('node:crypto')
    const realToken = signCursor(SESSION_ID, 0)
    const [payloadEncoded] = realToken.split('.')
    const wrongSig = createHmac('sha256', 'wrong-secret').update(payloadEncoded).digest('base64url')
    expect(verifyCursor(`${payloadEncoded}.${wrongSig}`)).toBeNull()
  })
})
