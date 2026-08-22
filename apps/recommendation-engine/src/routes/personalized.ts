import { eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../db/client.js'
import { profileTaste } from '../db/schema.js'
import { runRecommendationFromPlan } from '../pipeline/recommendation-service.js'
import { pgClient } from '../db/client.js'
import type { MediaType } from '../pipeline/types.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'

const personalizedBodySchema = z.object({
  profileId: z.string().uuid(),
  mediaTypes: z.array(z.enum(['movie', 'series'])).optional().default(['movie', 'series']),
  limit: z.number().int().min(1).max(100).optional().default(24),
  debug: z.boolean().optional().default(false),
})

function topByScore(scores: Record<string, number>, n: number): string[] {
  return Object.entries(scores)
    .filter(([, s]) => s > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([k]) => k)
}

export async function buildProfileQueryPlan(
  profileId: string,
  mediaTypes: MediaType[],
): Promise<RecommendationQueryPlan> {
  const [row] = await db
    .select({
      genreScores: profileTaste.genreScores,
      genreMeta: profileTaste.genreMeta,
      keywordScores: profileTaste.keywordScores,
      languageScores: profileTaste.languageScores,
      decadeScores: profileTaste.decadeScores,
      signalCount: profileTaste.signalCount,
    })
    .from(profileTaste)
    .where(eq(profileTaste.profileId, profileId))

  const planMediaTypes = mediaTypes.map((t) => t.toUpperCase() as 'MOVIE' | 'SERIES')
  const coldStart = !row || (row.signalCount ?? 0) === 0

  if (coldStart) {
    return {
      schemaVersion: '1',
      rawQuery: '',
      displayTitle: 'Personalized',
      semanticIntent: '',
      desiredThemes: [],
      desiredTone: [],
      avoidSignals: [],
      mediaTypes: planMediaTypes,
      hardFilters: {},
      softPreferences: {},
      userConstraints: [],
      plannerFallback: true,
      plannerMeta: null,
    }
  }

  const genreScores = (row.genreScores ?? {}) as Record<string, number>
  const genreMeta = (row.genreMeta ?? {}) as Record<string, { name: string; slug: string }>
  const keywordScores = (row.keywordScores ?? {}) as Record<string, number>
  const languageScores = (row.languageScores ?? {}) as Record<string, number>
  const decadeScores = (row.decadeScores ?? {}) as Record<string, number>

  const topGenreIds = topByScore(genreScores, 5)
  const topGenreNames = topGenreIds.map((id) => genreMeta[id]?.name).filter(Boolean) as string[]
  const topKeywords = topByScore(keywordScores, 5)
  const topLanguages = topByScore(languageScores, 3)
  const topDecades = topByScore(decadeScores, 2)

  const parts: string[] = []
  if (topGenreNames.length > 0) parts.push(`Genres : ${topGenreNames.join(', ')}`)
  if (topKeywords.length > 0) parts.push(`Thèmes : ${topKeywords.join(', ')}`)
  if (topLanguages.length > 0) parts.push(`Langues : ${topLanguages.join(', ')}`)
  if (topDecades.length > 0) parts.push(`Époques : ${topDecades.join(', ')}`)

  return {
    schemaVersion: '1',
    rawQuery: '',
    displayTitle: 'Personalized',
    semanticIntent: parts.join('. '),
    desiredThemes: topGenreNames.slice(0, 3),
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: planMediaTypes,
    hardFilters: {},
    softPreferences: {
      preferredDecades: topDecades,
      preferredLanguages: topLanguages,
    },
    userConstraints: [],
    plannerFallback: true,
    plannerMeta: null,
  }
}

export async function personalizedRoutes(app: FastifyInstance) {
  app.post('/v1/personalized', async (request, reply) => {
    const parsed = personalizedBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid request body', details: parsed.error.issues })
    }

    const body = parsed.data

    const rows = await pgClient<{ id: string }[]>`
      SELECT id FROM profiles WHERE id = ${body.profileId} LIMIT 1
    `
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Profile not found' })
    }

    const plan = await buildProfileQueryPlan(body.profileId, body.mediaTypes)

    const result = await runRecommendationFromPlan(
      plan,
      {
        profileId: body.profileId,
        mediaTypes: body.mediaTypes,
        limit: body.limit,
        debug: body.debug,
      },
      String(request.id),
      request.log,
    )

    return reply.send(result)
  })
}
