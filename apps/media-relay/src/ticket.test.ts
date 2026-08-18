import { describe, expect, it } from 'vitest'
import { signRelayTicket, verifyRelayTicket } from './ticket.js'

describe('relay ticket', () => {
  it('round-trips a signed payload', () => {
    const secret = 'test-secret'
    const ticket = signRelayTicket(
      { u: 'https://provider.example/movie/u/p/1.mp4', e: 'mp4', exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
    )
    const payload = verifyRelayTicket(ticket, secret)
    expect(payload.e).toBe('mp4')
    expect(payload.u).toContain('/1.mp4')
  })

  it('round-trips an optional resume offset', () => {
    const secret = 'test-secret'
    const ticket = signRelayTicket(
      { u: 'https://provider.example/x.mkv', e: 'mkv', exp: Math.floor(Date.now() / 1000) + 60, s: 600 },
      secret,
    )
    expect(verifyRelayTicket(ticket, secret).s).toBe(600)
  })

  it('rejects tampered tickets', () => {
    const secret = 'test-secret'
    const ticket = signRelayTicket(
      { u: 'https://provider.example/x.mp4', e: 'mp4', exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
    )
    expect(() => verifyRelayTicket(ticket + 'x', secret)).toThrow()
  })
})
