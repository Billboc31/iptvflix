import type { FastifyInstance } from 'fastify'
import { timingSafeEqual } from 'node:crypto'
import { MEDIA_RELAY_SECRET } from '../config/env.js'
import { setLiveMediaRelayUrl } from '../services/media-relay-runtime.js'

function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export async function mediaRelayHeartbeatRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { url?: string; secret?: string } }>('/internal/media-relay/heartbeat', async (request, reply) => {
    if (!MEDIA_RELAY_SECRET) {
      return reply.status(503).send({ error: 'media_relay_not_configured' })
    }
    const headerSecret = request.headers['x-media-relay-secret']
    const provided = (typeof headerSecret === 'string' ? headerSecret : '') || request.body?.secret || ''
    if (!provided || !secretsEqual(provided, MEDIA_RELAY_SECRET)) {
      return reply.status(401).send({ error: 'unauthorized' })
    }
    const url = request.body?.url?.trim()
    if (!url || !/^https:\/\//i.test(url)) {
      return reply.status(400).send({ error: 'invalid_url' })
    }
    setLiveMediaRelayUrl(url)
    request.log.info({ host: new URL(url).host }, 'media-relay heartbeat accepted')
    return { ok: true }
  })
}
