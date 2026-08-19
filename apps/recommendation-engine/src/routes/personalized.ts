import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies, series } from '../db/schema.js'
import { runHybridReranker, SCORE_MODEL_V1 } from '../pipeline/stages/hybrid-reranker.js'
import { PIPELINE_VERSION } from '../pipeline/pipeline.js'
import type { CandidateItem, PipelineContext } from '../pipeline/types.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { pgClient } from '../db/client.js'

const CANDIDATE_POOL_SIZE = 200

const personalizedBodySchema = z.object({
  profileId: z.string().uuid(),
  mediaTypes: z.array(z.enum(['movie', 'series'])).optional().default(['movie', 'series']),
  limit: z.number().int().min(1).max(100).optional().default(24),
  debug: z.boolean().optional().default(false),
})

async function fetchCatalogCandidates(
  mediaTypes: ('movie' | 'series')[],
  poolSize: number,
): Promise<CandidateItem[]> {
  const wantMovies = mediaTypes.includes('movie')
  const wantSeries = mediaTypes.includes('series')
  const candidates: CandidateItem[] = []

  if (wantMovies) {
    const rows = await db
      .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
      .from(movies)
      .orderBy(desc(movies.popularity), desc(movies.voteAverage))
      .limit(wantSeries ? Math.ceil(poolSize / 2) : poolSize)

    for (const r of rows) {
      candidates.push({ id: r.id, mediaType: 'movie', title: r.title, year: r.year ?? null, posterPath: r.posterPath ?? null })
    }
  }

  if (wantSeries) {
    const rows = await db
      .select({ id: series.id, title: series.title, year: series.firstAirYear, posterPath: series.posterPath })
      .from(series)
      .orderBy(desc(series.popularity), desc(series.voteAverage))
      .limit(wantMovies ? Math.floor(poolSize / 2) : poolSize)

    for (const r of rows) {
      candidates.push({ id: r.id, mediaType: 'series', title: r.title, year: r.year ?? null, posterPath: r.posterPath ?? null })
    }
  }

  return candidates
}

function buildNeutralPlan(mediaTypes: ('movie' | 'series')[]): RecommendationQueryPlan {
  return {
    schemaVersion: '1',
    rawQuery: '',
    displayTitle: 'Personalized',
    semanticIntent: '',
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: mediaTypes.map((t) => t.toUpperCase() as 'MOVIE' | 'SERIES'),
    hardFilters: {},
    softPreferences: {},
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

    // Verify profile exists
    const rows = await pgClient<{ id: string }[]>`
      SELECT id FROM profiles WHERE id = ${body.profileId} LIMIT 1
    `
    if (rows.length === 0) {
      return reply.status(404).send({ error: 'Profile not found' })
    }

    const startedAt = Date.now()
    const requestId = String(request.id)
    const queryPlan = buildNeutralPlan(body.mediaTypes)

    const candidates = await fetchCatalogCandidates(body.mediaTypes, CANDIDATE_POOL_SIZE)

    const ctx: PipelineContext = {
      requestId,
      request: { text: '', profileId: body.profileId, mediaTypes: body.mediaTypes, limit: body.limit, debug: body.debug },
      startedAt,
      log: request.log,
      queryPlan,
    }

    const rerankerResult = await runHybridReranker(ctx, candidates)
    const results = rerankerResult.available && (rerankerResult.candidates?.length ?? 0) > 0
      ? (rerankerResult.candidates ?? [])
      : candidates.slice(0, body.limit)

    const totalMs = Date.now() - startedAt

    return reply.send({
      requestId,
      results,
      timing: { totalMs, stages: { 'hybrid-reranker': rerankerResult.durationMs } },
      engineMetadata: {
        engineVersion: PIPELINE_VERSION,
        embeddingModelVersion: 'none',
        plannerModelVersion: 'none/profile-only',
        rerankerVersion: SCORE_MODEL_V1.version,
        timingsMs: { 'hybrid-reranker': rerankerResult.durationMs },
        fallbackFlags: rerankerResult.available ? [] : ['hybrid-reranker'],
      },
    })
  })
}
