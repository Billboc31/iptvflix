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

  it('rejects tampered tickets', () => {
    const secret = 'test-secret'
    const ticket = signRelayTicket(
      { u: 'https://provider.example/x.mp4', e: 'mp4', exp: Math.floor(Date.now() / 1000) + 60 },
      secret,
    )
    expect(() => verifyRelayTicket(ticket + 'x', secret)).toThrow()
  })
})
