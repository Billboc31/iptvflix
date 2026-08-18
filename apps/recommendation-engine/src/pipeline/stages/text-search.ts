import { pgClient } from '../../db/client.js'
import type { StageResult, CandidateItem, PipelineContext } from '../types.js'

export async function runTextSearch(ctx: PipelineContext): Promise<StageResult> {
  const start = Date.now()
  const { request } = ctx
  const limit = request.limit ?? 24
  const mediaTypes = request.mediaTypes ?? ['movie', 'series']
  const text = request.text

  try {
    const candidates: CandidateItem[] = []

    if (mediaTypes.includes('movie')) {
      const rows = await pgClient<
        { id: string; title: string; year: number | null; poster_path: string | null; score: string }[]
      >`
        SELECT id, title, year, poster_path,
          GREATEST(
            CASE WHEN title ILIKE ${'%' + text + '%'} THEN 1.5 ELSE 0 END,
            CASE
              WHEN to_tsvector('simple', title || ' ' || COALESCE(synopsis, ''))
                   @@ websearch_to_tsquery('simple', ${text})
              THEN ts_rank(
                to_tsvector('simple', title || ' ' || COALESCE(synopsis, '')),
                websearch_to_tsquery('simple', ${text})
              )
              ELSE 0
            END
          ) AS score
        FROM movies
        WHERE
          title ILIKE ${'%' + text + '%'}
          OR (
            to_tsvector('simple', title || ' ' || COALESCE(synopsis, ''))
            @@ websearch_to_tsquery('simple', ${text})
          )
        ORDER BY score DESC
        LIMIT ${limit}
      `
      for (const row of rows) {
        candidates.push({
          id: row.id,
          mediaType: 'movie',
          title: row.title,
          year: row.year,
          posterPath: row.poster_path,
          score: Number(row.score),
        })
      }
    }

    if (mediaTypes.includes('series')) {
      const rows = await pgClient<
        { id: string; title: string; year: number | null; poster_path: string | null; score: string }[]
      >`
        SELECT id, title, first_air_year AS year, poster_path,
          GREATEST(
            CASE WHEN title ILIKE ${'%' + text + '%'} THEN 1.5 ELSE 0 END,
            CASE
              WHEN to_tsvector('simple', title || ' ' || COALESCE(synopsis, ''))
                   @@ websearch_to_tsquery('simple', ${text})
              THEN ts_rank(
                to_tsvector('simple', title || ' ' || COALESCE(synopsis, '')),
                websearch_to_tsquery('simple', ${text})
              )
              ELSE 0
            END
          ) AS score
        FROM series
        WHERE
          title ILIKE ${'%' + text + '%'}
          OR (
            to_tsvector('simple', title || ' ' || COALESCE(synopsis, ''))
            @@ websearch_to_tsquery('simple', ${text})
          )
        ORDER BY score DESC
        LIMIT ${limit}
      `
      for (const row of rows) {
        candidates.push({
          id: row.id,
          mediaType: 'series',
          title: row.title,
          year: row.year,
          posterPath: row.poster_path,
          score: Number(row.score),
        })
      }
    }

    candidates.sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    const limited = candidates.slice(0, limit)

    const durationMs = Date.now() - start
    ctx.log.info(
      { requestId: ctx.requestId, stage: 'text-search', durationMs, candidateCount: limited.length },
      'stage complete',
    )

    return {
      stage: 'text-search',
      available: true,
      durationMs,
      inputCount: 0,
      outputCount: limited.length,
      candidates: limited,
    }
  } catch (err) {
    const durationMs = Date.now() - start
    ctx.log.error({ requestId: ctx.requestId, stage: 'text-search', durationMs, err }, 'stage error')
    return {
      stage: 'text-search',
      available: false,
      reason: 'Database query error',
      durationMs,
      inputCount: 0,
      outputCount: 0,
      candidates: [],
    }
  }
}
