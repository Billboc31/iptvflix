import { describe, expect, it } from 'vitest'
import { buildMediaRelayPlayUrl, signRelayTicket } from '../media-relay-ticket.js'
import { createHmac } from 'node:crypto'

describe('media-relay-ticket', () => {
  it('builds a play URL with a verifiable ticket', () => {
    const secret = 's3cret'
    const url = buildMediaRelayPlayUrl({
      relayBaseUrl: 'https://relay.example',
      secret,
      providerStreamUrl: 'http://cf.example/movie/u/p/1.mp4',
      containerExtension: 'mp4',
      ttlSeconds: 120,
    })
    expect(url.startsWith('https://relay.example/v1/play?ticket=')).toBe(true)
    const ticket = decodeURIComponent(url.split('ticket=')[1]!)
    const [body, sig] = ticket.split('.')
    const expected = createHmac('sha256', secret).update(body!).digest('base64url')
    expect(sig).toBe(expected)
    const payload = JSON.parse(Buffer.from(body!, 'base64url').toString('utf8'))
    expect(payload.e).toBe('mp4')
    expect(payload.u).toContain('/1.mp4')
    expect(payload.s).toBeUndefined()
  })

  it('embeds resume offset on the ticket when start is past 30 seconds', () => {
    const url = buildMediaRelayPlayUrl({
      relayBaseUrl: 'https://relay.example',
      secret: 's3cret',
      providerStreamUrl: 'http://cf.example/movie/u/p/1.mkv',
      containerExtension: 'mkv',
      ttlSeconds: 120,
      startPositionSeconds: 600,
    })
    const ticket = decodeURIComponent(url.split('ticket=')[1]!)
    const body = ticket.split('.')[0]!
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    expect(payload.s).toBe(600)
  })

  it('signRelayTicket is deterministic for same payload', () => {
    const payload = { u: 'https://x/y.mkv', e: 'mkv', exp: 9999999999 }
    expect(signRelayTicket(payload, 'a')).toBe(signRelayTicket(payload, 'a'))
  })
})
