import OpenAI from 'openai'
import { pgClient } from '../../db/client.js'
import { OPENAI_API_KEY, EMBEDDING_MODEL_PROVIDER, EMBEDDING_MODEL_NAME, SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP } from '../../config.js'
import type { StageResult, CandidateItem, PipelineContext } from '../types.js'

let pgvectorAvailable: boolean | null = null

async function checkPgvector(): Promise<boolean> {
  if (pgvectorAvailable !== null) return pgvectorAvailable
  try {
    await pgClient`SELECT 1 FROM pg_extension WHERE extname = 'vector'`
    const rows = await pgClient<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM pg_extension WHERE extname = 'vector'
    `
    pgvectorAvailable = Number(rows[0]?.count ?? 0) > 0
  } catch {
    pgvectorAvailable = false
  }
  return pgvectorAvailable
}

async function embedQuery(openai: OpenAI, text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL_NAME,
    input: text,
  })
  return response.data[0]?.embedding ?? []
}

export async function runSemanticSearch(
  ctx: PipelineContext,
  inputCandidates: CandidateItem[],
): Promise<StageResult> {
  const start = Date.now()

  if (!OPENAI_API_KEY) {
    return {
      stage: 'semantic-search',
      available: false,
      reason: 'OPENAI_API_KEY not configured',
      durationMs: Date.now() - start,
      inputCount: inputCandidates.length,
      outputCount: 0,
    }
  }

  const semanticIntent = ctx.queryPlan?.semanticIntent ?? ctx.request.text
  const retrievalLimit = Math.min(
    ctx.candidatePoolSize ?? SEMANTIC_RETRIEVAL_LIMIT,
    SEMANTIC_RETRIEVAL_MAX_CAP,
  )
  const mediaTypes = ctx.request.mediaTypes ?? ['movie', 'series']

  // Hoisted so the catch block can include them in diagnostics
  let totalCount = 0
  let eligibleCount = 0
  let detectedModels: string[] = []
  let usePgvector: boolean | null = null
  let queryVectorDim: number | null = null

  try {
    // Pre-flight: total corpus count (any model)
    const totalRows = await pgClient<{ count: string }[]>`SELECT COUNT(*) AS count FROM media_embeddings`
    totalCount = Number(totalRows[0]?.count ?? 0)

    if (totalCount === 0) {
      return {
        stage: 'semantic-search',
        available: false,
        reason: 'no embeddings indexed',
        durationMs: Date.now() - start,
        inputCount: inputCandidates.length,
        outputCount: 0,
        diagnostics: { totalEmbeddings: 0, eligibleEmbeddings: 0, detectedModels: [], usePgvector: null, retrievalLimit, queryVectorDim: null, retrievedRawRows: 0 },
      }
    }

    // Pre-flight: rows matching the configured model
    const eligibleRows = await pgClient<{ count: string }[]>`
      SELECT COUNT(*) AS count FROM media_embeddings
      WHERE model_provider = ${EMBEDDING_MODEL_PROVIDER} AND model_name = ${EMBEDDING_MODEL_NAME}
    `
    eligibleCount = Number(eligibleRows[0]?.count ?? 0)

    // Pre-flight: distinct model labels present in corpus (sanitized, no embedding data)
    const detectedModelsRows = await pgClient<{ m: string }[]>`
      SELECT DISTINCT model_provider || '/' || model_name AS m FROM media_embeddings LIMIT 10
    `
    detectedModels = detectedModelsRows.map((r) => r.m)

    if (eligibleCount === 0) {
      ctx.log.warn(
        { requestId: ctx.requestId, configuredModel: `${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}`, detectedModels, totalEmbeddings: totalCount },
        'semantic-search: no embeddings match configured model',
      )
      return {
        stage: 'semantic-search',
        available: false,
        reason: `no embeddings matching configured model (${EMBEDDING_MODEL_PROVIDER}/${EMBEDDING_MODEL_NAME}); corpus has: ${detectedModels.join(', ')}`,
        durationMs: Date.now() - start,
        inputCount: inputCandidates.length,
        outputCount: 0,
        diagnostics: { totalEmbeddings: totalCount, eligibleEmbeddings: 0, detectedModels, usePgvector: null, retrievalLimit, queryVectorDim: null, retrievedRawRows: 0 },
      }
    }

    const openai = new OpenAI({ apiKey: OPENAI_API_KEY })
    const queryVector = await embedQuery(openai, semanticIntent)
    queryVectorDim = queryVector.length
    usePgvector = await checkPgvector()

    const vectorLiteral = `'[${queryVector.join(',')}]'`
    const arrayLiteral = `ARRAY[${queryVector.join(',')}]::double precision[]`
    const distanceExpr = usePgvector
      ? `(me.embedding::vector <=> ${vectorLiteral}::vector)`
      : `(1.0 - (
          (SELECT COALESCE(SUM(x * y), 0) FROM unnest(me.embedding, ${arrayLiteral}) AS t(x, y))
          / NULLIF(
            sqrt((SELECT COALESCE(SUM(x * x), 0) FROM unnest(me.embedding) AS u(x)))
            * sqrt((SELECT COALESCE(SUM(y * y), 0) FROM unnest(${arrayLiteral}) AS v(y))),
            0
          )
        ))`

    const allowedTypes = mediaTypes
      .map((t) => `'${t}'`)
      .join(', ')

    const rows = await pgClient<{
      media_id: string
      media_type: string
      title: string
      year: number | null
      poster_path: string | null
      distance: string
    }[]>`
      SELECT
        me.media_id,
        me.media_type,
        CASE me.media_type
          WHEN 'movie' THEN m.title
          WHEN 'series' THEN s.title
          ELSE ''
        END AS title,
        CASE me.media_type
          WHEN 'movie' THEN m.year
          WHEN 'series' THEN s.first_air_year
          ELSE NULL
        END AS year,
        CASE me.media_type
          WHEN 'movie' THEN m.poster_path
          WHEN 'series' THEN s.poster_path
          ELSE NULL
        END AS poster_path,
        ${pgClient.unsafe(distanceExpr)} AS distance
      FROM media_embeddings me
      LEFT JOIN movies m ON me.media_type = 'movie' AND me.media_id = m.id
      LEFT JOIN series s ON me.media_type = 'series' AND me.media_id = s.id
      WHERE
        me.model_provider = ${EMBEDDING_MODEL_PROVIDER}
        AND me.model_name = ${EMBEDDING_MODEL_NAME}
        AND me.media_type IN (${pgClient.unsafe(allowedTypes)})
      ORDER BY ${pgClient.unsafe(distanceExpr)} ASC
      LIMIT ${retrievalLimit}
    `

    const retrievedRawRows = rows.length

    const candidates: CandidateItem[] = rows.map((row) => ({
      id: row.media_id,
      mediaType: row.media_type as 'movie' | 'series',
      title: row.title,
      year: row.year,
      posterPath: row.poster_path,
      similarity: Math.max(0, 1 - Number(row.distance)),
      score: Math.max(0, 1 - Number(row.distance)),
    }))

    ctx.log.info(
      { requestId: ctx.requestId, stage: 'semantic-search', durationMs: Date.now() - start, retrievalLimit, candidateCount: candidates.length, usePgvector, queryVectorDim, totalEmbeddings: totalCount, eligibleEmbeddings: eligibleCount },
      'stage complete',
    )

    return {
      stage: 'semantic-search',
      available: true,
      durationMs: Date.now() - start,
      inputCount: inputCandidates.length,
      outputCount: candidates.length,
      candidates,
      diagnostics: { totalEmbeddings: totalCount, eligibleEmbeddings: eligibleCount, detectedModels, usePgvector, retrievalLimit, queryVectorDim, retrievedRawRows },
    }
  } catch (err) {
    ctx.log.error({ requestId: ctx.requestId, stage: 'semantic-search', err }, 'stage error')
    return {
      stage: 'semantic-search',
      available: false,
      reason: `semantic search error: ${(err as Error).message}`,
      durationMs: Date.now() - start,
      inputCount: inputCandidates.length,
      outputCount: 0,
      diagnostics: {
        totalEmbeddings: totalCount,
        eligibleEmbeddings: eligibleCount,
        detectedModels,
        usePgvector,
        retrievalLimit,
        queryVectorDim,
        retrievedRawRows: 0,
      },
    }
  }
}
