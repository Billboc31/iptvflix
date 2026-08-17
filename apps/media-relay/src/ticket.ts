import { createHmac, timingSafeEqual } from 'node:crypto'

export type RelayTicketPayload = {
  /** Provider stream URL (may contain credentials). Never log. */
  u: string
  /** Container extension hint: mp4 | mkv | ts | … */
  e: string
  /** Expiry unix seconds */
  exp: number
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s, 'base64url')
}

export function signRelayTicket(payload: RelayTicketPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyRelayTicket(ticket: string, secret: string, nowSec = Math.floor(Date.now() / 1000)): RelayTicketPayload {
  const [body, sig] = ticket.split('.')
  if (!body || !sig) throw new Error('invalid_ticket')
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('invalid_ticket_sig')
  const payload = JSON.parse(fromB64url(body).toString('utf8')) as RelayTicketPayload
  if (!payload?.u || typeof payload.u !== 'string') throw new Error('invalid_ticket_payload')
  if (!payload.exp || payload.exp < nowSec) throw new Error('ticket_expired')
  return payload
}
