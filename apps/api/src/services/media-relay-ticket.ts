import { createHmac } from 'node:crypto'

export type RelayTicketPayload = {
  u: string
  e: string
  exp: number
  /** Resume offset in seconds for remux (-ss). */
  s?: number
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url')
}

/** Sign a short-lived playback ticket for the external media relay. */
export function signRelayTicket(payload: RelayTicketPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), 'utf8'))
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function buildMediaRelayPlayUrl(opts: {
  relayBaseUrl: string
  secret: string
  providerStreamUrl: string
  containerExtension: string | null | undefined
  ttlSeconds?: number
  startPositionSeconds?: number
}): string {
  const base = opts.relayBaseUrl.replace(/\/$/, '')
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 2 * 60 * 60)
  const start = Math.floor(opts.startPositionSeconds ?? 0)
  const ticket = signRelayTicket(
    {
      u: opts.providerStreamUrl,
      e: (opts.containerExtension || 'mp4').replace(/^\./, ''),
      exp,
      ...(start > 30 ? { s: start } : {}),
    },
    opts.secret,
  )
  return `${base}/v1/play?ticket=${encodeURIComponent(ticket)}`
}
