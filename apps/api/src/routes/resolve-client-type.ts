import type { FastifyRequest } from 'fastify'

export type ResolvedClientType = 'web' | 'android-tv'

type ClientTypeRequest = FastifyRequest<{
  Body?: { clientType?: string }
  Querystring?: { clientType?: string }
}>

export function resolveClientType(request: ClientTypeRequest): ResolvedClientType | undefined {
  const fromBody = request.body?.clientType
  if (fromBody === 'android-tv' || fromBody === 'web') return fromBody

  const fromQuery = request.query?.clientType
  if (fromQuery === 'android-tv' || fromQuery === 'web') return fromQuery

  const fromHeader = request.headers['x-client-type']
  if (fromHeader === 'android-tv' || fromHeader === 'web') return fromHeader

  const ua = request.headers['user-agent'] ?? ''
  if (ua.includes('IPTVFlix-AndroidTV')) return 'android-tv'

  return undefined
}
