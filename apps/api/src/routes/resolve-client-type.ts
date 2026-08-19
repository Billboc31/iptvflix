import type { FastifyRequest } from 'fastify'
import type { PlaybackResolveRequest } from '@iptvflix/api-contracts'

export type ResolvedClientType = 'web' | 'android-tv'

export function resolveClientType(
  request: FastifyRequest<{ Body?: PlaybackResolveRequest; Querystring?: { clientType?: string } }>,
): ResolvedClientType | undefined {
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
