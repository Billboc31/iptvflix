import type { FastifyInstance } from 'fastify'
import { rankRecommendations } from '../services/recommendation-ranking-service.js'
import type { AvailabilityPolicy } from '../services/recommendation-ranking-service.js'
import { getCurrentProfile } from '../services/profile-service.js'
import { NotFoundError } from '../errors.js'
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js'
import type { RecommendationCandidate } from '@iptvflix/api-contracts'

const VALID_POLICIES = new Set<string>(['ALL', 'WATCH_NOW', 'DISCOVERY', 'UPCOMING'])

export async function recommendationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { profileId: string }
    Querystring: {
      mediaType?: string
      availableToMe?: string
      policy?: string
      includeSeen?: string
      limit?: string
    }
  }>('/profiles/:profileId/recommendations', async (request, reply) => {
    const { profileId } = request.params
    const { mediaType, availableToMe, policy, includeSeen, limit } = request.query

    try {
      await getCurrentProfile(request.account!.id, profileId)
    } catch {
      return reply.status(403).send({ error: 'Profile does not belong to this account' })
    }

    if (mediaType !== undefined && mediaType !== 'MOVIE' && mediaType !== 'SERIES') {
      return reply.status(400).send({ error: 'mediaType must be MOVIE or SERIES' })
    }

    if (policy !== undefined && !VALID_POLICIES.has(policy)) {
      return reply.status(400).send({ error: 'policy must be ALL, WATCH_NOW, DISCOVERY, or UPCOMING' })
    }

    const limitNum = limit !== undefined ? parseInt(limit, 10) : undefined
    if (limitNum !== undefined && (isNaN(limitNum) || limitNum < 1 || limitNum > 100)) {
      return reply.status(400).send({ error: 'limit must be an integer between 1 and 100' })
    }

    const mediaTypes =
      mediaType === 'MOVIE' ? ['movie' as const]
      : mediaType === 'SERIES' ? ['series' as const]
      : undefined

    const engineResult = await RecommendationEngineClient.personalized({
      profileId,
      mediaTypes,
      limit: limitNum,
    })

    if (engineResult) {
      const candidates: RecommendationCandidate[] = engineResult.results.map((r) => ({
        mediaType: r.mediaType === 'movie' ? 'MOVIE' : 'SERIES',
        mediaId: r.id,
        title: r.title,
        year: r.year ?? null,
        posterPath: r.posterPath ?? null,
        score: r.score ?? 0,
        reasons: r.reasons ?? [],
        source: 'ENGINE' as const,
        available: true,
      }))
      return reply.status(200).send({
        profileId,
        coldStart: false,
        candidates,
        engineMetadata: engineResult.engineMetadata,
      })
    }

    try {
      const result = await rankRecommendations(profileId, {
        mediaType: mediaType as 'MOVIE' | 'SERIES' | undefined,
        availableToMe: availableToMe === 'true',
        availabilityPolicy: policy as AvailabilityPolicy | undefined,
        includeSeen: includeSeen === 'true',
        limit: limitNum,
      })
      return reply.status(200).send(result)
    } catch (err) {
      if (err instanceof NotFoundError) {
        return reply.status(404).send({ error: err.message })
      }
      throw err
    }
  })
}
