import type { FastifyRequest, FastifyReply } from 'fastify'
import { WEB_SECRET } from '../config/env.js'

export async function authenticateWeb(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (!WEB_SECRET) {
    reply.status(503).send({ error: 'Web authentication not configured (WEB_SECRET missing)' })
    return false
  }
  const auth = request.headers.authorization
  if (!auth?.startsWith('Bearer ') || auth.slice(7) !== WEB_SECRET) {
    reply.status(401).send({ error: 'Web authentication required' })
    return false
  }
  return true
}
