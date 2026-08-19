import type { FastifyRequest, FastifyReply } from 'fastify'
import { WEB_SECRET } from '../config/env.js'

function extractBearerToken(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return undefined
}

/**
 * Auth for web-initiated device/pairing routes.
 * Accepts either the legacy static WEB_SECRET or a logged-in user's JWT (same as /auth/login).
 */
export async function authenticateWeb(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const bearer = extractBearerToken(request)
  if (WEB_SECRET && bearer === WEB_SECRET) {
    return true
  }

  const token = request.cookies?.token ?? bearer
  if (!token) {
    reply.status(401).send({ error: 'Web authentication required' })
    return false
  }

  try {
    const decoded = request.server.jwt.verify<{
      username: string
      accountId?: string
      profileId?: string
    }>(token)
    request.user = decoded
    if (decoded.accountId) {
      request.account = { id: decoded.accountId, username: decoded.username }
    }
    return true
  } catch {
    reply.status(401).send({ error: 'Web authentication required' })
    return false
  }
}
