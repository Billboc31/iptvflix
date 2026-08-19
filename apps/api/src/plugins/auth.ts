import type { FastifyRequest, FastifyReply } from 'fastify'
import { createHash } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { profiles, devices, accounts } from '../db/schema/index.js'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { username: string; accountId?: string; profileId?: string }
    user: { username: string; accountId?: string; profileId?: string }
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    account?: { id: string; username: string }
    profileId?: string
    device?: typeof devices.$inferSelect
  }
}

function extractBearerToken(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return undefined
}

async function authenticateDeviceToken(
  request: FastifyRequest,
  token: string,
): Promise<boolean> {
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const [device] = await db.select().from(devices).where(eq(devices.tokenHash, tokenHash))

  if (!device || device.revokedAt || !device.accountId) {
    return false
  }

  const [account] = await db
    .select({ id: accounts.id, username: accounts.username })
    .from(accounts)
    .where(eq(accounts.id, device.accountId))

  if (!account) {
    return false
  }

  await db
    .update(devices)
    .set({ lastSeenAt: new Date() })
    .where(eq(devices.id, device.id))

  request.device = device
  request.account = account
  request.user = { username: account.username, accountId: account.id }
  return true
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies?.token ?? extractBearerToken(request)
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
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

      if (decoded.profileId) {
        // Verify the profile still belongs to this account (guards against stale tokens)
        const [profile] = await db
          .select({ id: profiles.id })
          .from(profiles)
          .where(
            and(
              eq(profiles.id, decoded.profileId),
              eq(profiles.accountId, decoded.accountId),
            ),
          )
        if (profile) {
          request.profileId = decoded.profileId
        }
      }
    }
    return
  } catch {
    if (await authenticateDeviceToken(request, token)) {
      return
    }
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}

export async function requireProfile(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (!request.profileId) {
    return reply
      .status(403)
      .send({ error: 'No profile selected', code: 'PROFILE_NOT_SELECTED' })
  }
}
