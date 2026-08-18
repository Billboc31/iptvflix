import { eq, inArray } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import type { EmbeddingService, SemanticCandidate } from './embedding-service.js'
import type { MediaType } from './embedding-document-builder.js'

type Db = PostgresJsDatabase<typeof schema>

export interface SemanticResult extends SemanticCandidate {
  title: string
  year: number | null
  posterPath: string | null
}

export class SemanticRetrievalService {
  constructor(
    private readonly db: Db,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async retrieve(queryText: string, topK = 10, queryTextOverride?: string): Promise<SemanticResult[]> {
    const embedText = queryTextOverride ?? queryText
    const candidates = await this.embeddingService.semanticSearch(embedText, topK)
    return this.enrichWithMetadata(candidates)
  }

  private async enrichWithMetadata(candidates: SemanticCandidate[]): Promise<SemanticResult[]> {
    if (candidates.length === 0) return []

    const movieIds = candidates.filter((c) => c.mediaType === 'MOVIE').map((c) => c.mediaId)
    const seriesIds = candidates.filter((c) => c.mediaType === 'SERIES').map((c) => c.mediaId)

    const [movieRows, seriesRows] = await Promise.all([
      movieIds.length > 0
        ? this.db
            .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
            .from(movies)
            .where(inArray(movies.id, movieIds))
        : Promise.resolve([] as { id: string; title: string; year: number | null; posterPath: string | null }[]),
      seriesIds.length > 0
        ? this.db
            .select({
              id: series.id,
              title: series.title,
              year: series.firstAirYear,
              posterPath: series.posterPath,
            })
            .from(series)
            .where(inArray(series.id, seriesIds))
        : Promise.resolve([] as { id: string; title: string; year: number | null; posterPath: string | null }[]),
    ])

    const movieMap = new Map(movieRows.map((r) => [r.id, r]))
    const seriesMap = new Map(seriesRows.map((r) => [r.id, r]))

    return candidates
      .map((c) => {
        const meta = c.mediaType === 'MOVIE' ? movieMap.get(c.mediaId) : seriesMap.get(c.mediaId)
        return {
          ...c,
          title: meta?.title ?? 'Unknown',
          year: meta?.year ?? null,
          posterPath: meta?.posterPath ?? null,
        }
      })
      .filter((r) => r.title !== 'Unknown' || candidates.some((c) => c.mediaId === r.mediaId))
  }
}
