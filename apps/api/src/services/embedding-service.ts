import { eq, and, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { movies, movieGenres } from '../db/schema/movies.js'
import { series, seriesGenres } from '../db/schema/series.js'
import { genres } from '../db/schema/genres.js'
import { collections } from '../db/schema/collections.js'
import { mediaCredits } from '../db/schema/media-credits.js'
import { mediaEmbeddings } from '../db/schema/media-embeddings.js'
import {
  buildMovieEmbeddingDocument,
  buildSeriesEmbeddingDocument,
  hashDocument,
  type MediaType,
} from './embedding-document-builder.js'
import type { EmbeddingProvider } from './embedding-provider.js'

type Db = PostgresJsDatabase<typeof schema>

export type UpsertAction = 'embedded' | 'skipped' | 'not-found'

export interface UpsertResult {
  action: UpsertAction
  mediaId: string
  mediaType: MediaType
  docHash?: string
}

export interface SemanticCandidate {
  mediaId: string
  mediaType: MediaType
  similarity: number
  modelProvider: string
  modelName: string
  rank: number
  docHash: string
  generatedAt: Date
}

export class EmbeddingService {
  constructor(
    private readonly db: Db,
    private readonly provider: EmbeddingProvider,
  ) {}

  async upsertEmbedding(mediaId: string, mediaType: MediaType): Promise<UpsertResult> {
    const { document, docHash } = await this.buildDocumentForMedia(mediaId, mediaType)
    if (!document) {
      return { action: 'not-found', mediaId, mediaType }
    }

    // Skip if hash and model are unchanged
    const [existing] = await this.db
      .select({ id: mediaEmbeddings.id, docHash: mediaEmbeddings.docHash })
      .from(mediaEmbeddings)
      .where(
        and(
          eq(mediaEmbeddings.mediaId, mediaId),
          eq(mediaEmbeddings.mediaType, mediaType),
          eq(mediaEmbeddings.modelProvider, this.provider.modelProvider),
          eq(mediaEmbeddings.modelName, this.provider.modelName),
        ),
      )

    if (existing?.docHash === docHash) {
      return { action: 'skipped', mediaId, mediaType, docHash }
    }

    const vector = await this.provider.embed(document.text)

    await this.db
      .insert(mediaEmbeddings)
      .values({
        mediaId,
        mediaType,
        embedding: vector,
        modelProvider: this.provider.modelProvider,
        modelName: this.provider.modelName,
        embeddingDimension: this.provider.dimension,
        docHash,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [mediaEmbeddings.mediaId, mediaEmbeddings.mediaType, mediaEmbeddings.modelProvider, mediaEmbeddings.modelName],
        set: {
          embedding: sql`EXCLUDED.embedding`,
          embeddingDimension: sql`EXCLUDED.embedding_dimension`,
          docHash: sql`EXCLUDED.doc_hash`,
          generatedAt: sql`EXCLUDED.generated_at`,
        },
      })

    return { action: 'embedded', mediaId, mediaType, docHash }
  }

  async semanticSearch(queryText: string, topK: number): Promise<SemanticCandidate[]> {
    const queryVector = await this.provider.embed(queryText)
    const vectorLiteral = `[${queryVector.join(',')}]`

    const rows = await this.db
      .select({
        mediaId: mediaEmbeddings.mediaId,
        mediaType: mediaEmbeddings.mediaType,
        modelProvider: mediaEmbeddings.modelProvider,
        modelName: mediaEmbeddings.modelName,
        docHash: mediaEmbeddings.docHash,
        generatedAt: mediaEmbeddings.generatedAt,
        distance: sql<number>`${mediaEmbeddings.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}`,
      })
      .from(mediaEmbeddings)
      .where(
        and(
          eq(mediaEmbeddings.modelProvider, this.provider.modelProvider),
          eq(mediaEmbeddings.modelName, this.provider.modelName),
        ),
      )
      .orderBy(sql`${mediaEmbeddings.embedding} <=> ${sql.raw(`'${vectorLiteral}'::vector`)}`)
      .limit(topK)

    return rows.map((row, i) => ({
      mediaId: row.mediaId,
      mediaType: row.mediaType as MediaType,
      similarity: Math.max(0, 1 - row.distance),
      modelProvider: row.modelProvider,
      modelName: row.modelName,
      rank: i + 1,
      docHash: row.docHash,
      generatedAt: row.generatedAt,
    }))
  }

  private async buildDocumentForMedia(
    mediaId: string,
    mediaType: MediaType,
  ): Promise<{ document: ReturnType<typeof buildMovieEmbeddingDocument> | null; docHash: string }> {
    if (mediaType === 'MOVIE') {
      const [movie] = await this.db
        .select({
          id: movies.id,
          title: movies.title,
          originalTitle: movies.originalTitle,
          year: movies.year,
          synopsis: movies.synopsis,
          keywords: movies.keywords,
          originalLanguage: movies.originalLanguage,
          durationMinutes: movies.durationMinutes,
          voteAverage: movies.voteAverage,
          popularity: movies.popularity,
          certification: movies.certification,
          collectionId: movies.collectionId,
        })
        .from(movies)
        .where(eq(movies.id, mediaId))

      if (!movie) return { document: null, docHash: '' }

      const [genreRows, creditRows, collectionRow] = await Promise.all([
        this.db
          .select({ name: genres.name })
          .from(genres)
          .innerJoin(movieGenres, eq(movieGenres.genreId, genres.id))
          .where(eq(movieGenres.movieId, mediaId)),
        this.db
          .select({ role: mediaCredits.role, name: mediaCredits.name, creditOrder: mediaCredits.creditOrder })
          .from(mediaCredits)
          .where(and(eq(mediaCredits.mediaId, mediaId), eq(mediaCredits.mediaType, 'movie'))),
        movie.collectionId
          ? this.db.select({ name: collections.name }).from(collections).where(eq(collections.id, movie.collectionId))
          : Promise.resolve([] as { name: string }[]),
      ])

      const doc = buildMovieEmbeddingDocument(
        { ...movie, collectionName: collectionRow[0]?.name ?? null },
        genreRows,
        creditRows,
      )
      return { document: doc, docHash: hashDocument(doc) }
    } else {
      const [seriesRow] = await this.db
        .select({
          id: series.id,
          title: series.title,
          originalTitle: series.originalTitle,
          firstAirYear: series.firstAirYear,
          synopsis: series.synopsis,
          keywords: series.keywords,
          originalLanguage: series.originalLanguage,
          numberOfSeasons: series.numberOfSeasons,
          numberOfEpisodes: series.numberOfEpisodes,
          voteAverage: series.voteAverage,
          popularity: series.popularity,
          certification: series.certification,
        })
        .from(series)
        .where(eq(series.id, mediaId))

      if (!seriesRow) return { document: null, docHash: '' }

      const [genreRows, creditRows] = await Promise.all([
        this.db
          .select({ name: genres.name })
          .from(genres)
          .innerJoin(seriesGenres, eq(seriesGenres.genreId, genres.id))
          .where(eq(seriesGenres.seriesId, mediaId)),
        this.db
          .select({ role: mediaCredits.role, name: mediaCredits.name, creditOrder: mediaCredits.creditOrder })
          .from(mediaCredits)
          .where(and(eq(mediaCredits.mediaId, mediaId), eq(mediaCredits.mediaType, 'series'))),
      ])

      const doc = buildSeriesEmbeddingDocument(seriesRow, genreRows, creditRows)
      return { document: doc, docHash: hashDocument(doc) }
    }
  }
}
