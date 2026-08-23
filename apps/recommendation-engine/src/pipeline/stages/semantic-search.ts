import OpenAI from 'openai'
import { pgClient } from '../../db/client.js'
import { OPENAI_API_KEY, EMBEDDING_MODEL_PROVIDER, EMBEDDING_MODEL_NAME, SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP, SEMANTIC_ANCHOR_BLEND_ALPHA } from '../../config.js'
import type { StageResult, CandidateItem, PipelineContext, MediaType } from '../types.js'

let pgvectorAvailable: boolean | null = null
let detectedColumnType: string | null = null

async function checkPgvector(): Promise<boolean> {
  if (pgvectorAvailable !== null) return pgvectorAvailable
  try {
    const [extRows, colRows] = await Promise.all([
      pgClient<{ count: string }[]>`SELECT COUNT(*) AS count FROM pg_extension WHERE extname = 'vector'`,
      pgClient<{ udt_name: string }[]>`
        SELECT udt_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'media_embeddings' AND column_name = 'embedding'
      `,
    ])
    const hasExtension = Number(extRows[0]?.count ?? 0) > 0
    detectedColumnType = colRows[0]?.udt_name ?? null
    // Require both: extension installed AND column already migrated to vector type.
    // If the extension was added after initial deployment, migration 0040 may have been
    // a no-op, leaving the column as double precision[] — the ::vector cast would then fail.
    pgvectorAvailable = hasExtension && detectedColumnType === 'vector'
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

/** Pipeline uses lowercase media types; media_embeddings stores uppercase (MOVIE/SERIES). */
function toDbMediaType(t: MediaType): 'MOVIE' | 'SERIES' {
  return t === 'series' ? 'SERIES' : 'MOVIE'
}

function fromDbMediaType(t: string): MediaType {
  return t.toUpperCase() === 'SERIES' ? 'series' : 'movie'
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
  const dbMediaTypes = mediaTypes.map(toDbMediaType)

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

    const semanticAnchor = ctx.queryPlan?.semanticAnchor
    const useAnchorBlend = !!semanticAnchor && SEMANTIC_ANCHOR_BLEND_ALPHA > 0

    const [queryVector, anchorVector] = await Promise.all([
      embedQuery(openai, semanticIntent),
      useAnchorBlend ? embedQuery(openai, semanticAnchor!) : Promise.resolve([] as number[]),
    ])

    queryVectorDim = queryVector.length
    if (queryVector.length === 0) {
      return {
        stage: 'semantic-search',
        available: false,
        reason: 'empty query embedding',
        durationMs: Date.now() - start,
        inputCount: inputCandidates.length,
        outputCount: 0,
        diagnostics: { totalEmbeddings: totalCount, eligibleEmbeddings: eligibleCount, detectedModels, usePgvector: null, retrievalLimit, queryVectorDim, retrievedRawRows: 0 },
      }
    }

    usePgvector = await checkPgvector()

    const intentVectorLiteral = `'[${queryVector.join(',')}]'`
    const intentArrayLiteral = `ARRAY[${queryVector.join(',')}]::double precision[]`

    // Single-embedding distance (legacy path or when no anchor)
    const intentDistanceExpr = usePgvector
      ? `(me.embedding <=> ${intentVectorLiteral}::vector)`
      : `(1.0 - (
          (SELECT COALESCE(SUM(x * y), 0) FROM unnest(me.embedding, ${intentArrayLiteral}) AS t(x, y))
          / NULLIF(
            sqrt((SELECT COALESCE(SUM(x * x), 0) FROM unnest(me.embedding) AS u(x)))
            * sqrt((SELECT COALESCE(SUM(y * y), 0) FROM unnest(${intentArrayLiteral}) AS v(y))),
            0
          )
        ))`

    let distanceExpr: string
    if (useAnchorBlend && anchorVector.length > 0) {
      const anchorVectorLiteral = `'[${anchorVector.join(',')}]'`
      const anchorArrayLiteral = `ARRAY[${anchorVector.join(',')}]::double precision[]`
      const anchorDistanceExpr = usePgvector
        ? `(me.embedding <=> ${anchorVectorLiteral}::vector)`
        : `(1.0 - (
            (SELECT COALESCE(SUM(x * y), 0) FROM unnest(me.embedding, ${anchorArrayLiteral}) AS t(x, y))
            / NULLIF(
              sqrt((SELECT COALESCE(SUM(x * x), 0) FROM unnest(me.embedding) AS u(x)))
              * sqrt((SELECT COALESCE(SUM(y * y), 0) FROM unnest(${anchorArrayLiteral}) AS v(y))),
              0
            )
          ))`
      // blendedDistance = ALPHA * anchorDistance + (1 - ALPHA) * intentDistance
      // This preserves ordering equivalence: blendedSimilarity = ALPHA * anchorSim + (1-ALPHA) * intentSim
      distanceExpr = `(${SEMANTIC_ANCHOR_BLEND_ALPHA} * ${anchorDistanceExpr} + ${1 - SEMANTIC_ANCHOR_BLEND_ALPHA} * ${intentDistanceExpr})`
    } else {
      distanceExpr = intentDistanceExpr
    }

    // media_embeddings.media_type is stored as MOVIE/SERIES (API embedding convention).
    const allowedTypes = dbMediaTypes.map((t) => `'${t}'`).join(', ')

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
          WHEN 'MOVIE' THEN m.title
          WHEN 'SERIES' THEN s.title
          ELSE ''
        END AS title,
        CASE me.media_type
          WHEN 'MOVIE' THEN m.year
          WHEN 'SERIES' THEN s.first_air_year
          ELSE NULL
        END AS year,
        CASE me.media_type
          WHEN 'MOVIE' THEN m.poster_path
          WHEN 'SERIES' THEN s.poster_path
          ELSE NULL
        END AS poster_path,
        ${pgClient.unsafe(distanceExpr)} AS distance
      FROM media_embeddings me
      LEFT JOIN movies m ON me.media_type = 'MOVIE' AND me.media_id = m.id
      LEFT JOIN series s ON me.media_type = 'SERIES' AND me.media_id = s.id
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
      mediaType: fromDbMediaType(row.media_type),
      title: row.title || 'Unknown',
      year: row.year,
      posterPath: row.poster_path,
      similarity: Math.max(0, 1 - Number(row.distance)),
      score: Math.max(0, 1 - Number(row.distance)),
    }))

    ctx.log.info(
      {
        requestId: ctx.requestId,
        stage: 'semantic-search',
        durationMs: Date.now() - start,
        retrievalLimit,
        candidateCount: candidates.length,
        usePgvector,
        queryVectorDim,
        totalEmbeddings: totalCount,
        eligibleEmbeddings: eligibleCount,
        dbMediaTypes,
        anchorBlend: useAnchorBlend,
        semanticAnchorBlendAlpha: useAnchorBlend ? SEMANTIC_ANCHOR_BLEND_ALPHA : null,
      },
      'stage complete',
    )

    return {
      stage: 'semantic-search',
      available: true,
      durationMs: Date.now() - start,
      inputCount: inputCandidates.length,
      outputCount: candidates.length,
      candidates,
      diagnostics: {
        totalEmbeddings: totalCount,
        eligibleEmbeddings: eligibleCount,
        detectedModels,
        usePgvector,
        columnType: detectedColumnType,
        retrievalLimit,
        queryVectorDim,
        retrievedRawRows,
        dbMediaTypes,
        anchorBlend: useAnchorBlend,
        semanticAnchorBlendAlpha: useAnchorBlend ? SEMANTIC_ANCHOR_BLEND_ALPHA : null,
      },
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
        columnType: detectedColumnType,
        retrievalLimit,
        queryVectorDim,
        retrievedRawRows: 0,
      },
    }
  }
}
