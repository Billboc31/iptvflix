import type { FastifyRequest, FastifyReply } from 'fastify'

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { username: string }
    user: { username: string }
  }
}

function extractBearerToken(request: FastifyRequest): string | undefined {
  const auth = request.headers.authorization
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return undefined
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = request.cookies?.token ?? extractBearerToken(request)
  if (!token) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
  try {
    const decoded = request.server.jwt.verify<{ username: string }>(token)
    request.user = decoded
  } catch {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
}
