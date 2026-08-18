import { eq, and } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { seasons } from '../db/schema/seasons.js'
import { episodes } from '../db/schema/episodes.js'
import type { MetadataEnrichmentService } from './metadata-enrichment-service.js'

export interface ResolveMovieInput {
  tmdbId: number | null
  /** ID from title-matching pre-pass. undefined = not attempted; null = AMBIGUOUS or UNMATCHED */
  prePassId?: string | null
  tmdbCache?: Map<number, string>
}

export interface ResolveSeriesInput {
  tmdbId: number | null
  /** ID from title-matching pre-pass. undefined = not attempted; null = AMBIGUOUS or UNMATCHED */
  prePassId?: string | null
  tmdbCache?: Map<number, string>
}

export interface ResolveEpisodeInput {
  seriesId: string
  seasonNumber: number
  episodeNumber: number
  episodeMeta?: {
    title?: string | null
    synopsis?: string | null
    durationMinutes?: number | null
    airDate?: string | null
    posterPath?: string | null
  }
}

/**
 * Resolves provider items to canonical catalog entities without writing any provider
 * metadata to canonical fields. Canonical title/synopsis/poster are only populated
 * by MetadataEnrichmentService.
 *
 * Resolution order:
 *   1. TMDB ID present → local DB lookup → importByTmdbId if absent
 *   2. No TMDB ID → use pre-pass result (MATCHED canonical ID or null for AMBIGUOUS/UNMATCHED)
 *   3. Returns null when resolution fails — callers must skip availability creation.
 */
export class CanonicalResolver {
  constructor(
    private readonly enrichmentService: MetadataEnrichmentService,
    private readonly onNewEpisode?: (episodeId: string) => void,
  ) {}

  async resolveMovieCanonical(input: ResolveMovieInput): Promise<{ id: string } | null> {
    if (input.tmdbId != null) {
      const cached = input.tmdbCache?.get(input.tmdbId)
      if (cached) return { id: cached }

      const imported = await this.enrichmentService.importMovieByTmdbId(input.tmdbId)
      if (imported) {
        input.tmdbCache?.set(input.tmdbId, imported.id)
        return imported
      }
      return null
    }

    // prePassId === undefined → title matching was not attempted (no matchingService)
    // prePassId === null     → AMBIGUOUS or UNMATCHED: skip
    // prePassId === string   → MATCHED: use this canonical ID
    if (input.prePassId !== undefined) {
      return input.prePassId ? { id: input.prePassId } : null
    }

    return null
  }

  async resolveSeriesCanonical(input: ResolveSeriesInput): Promise<{ id: string } | null> {
    if (input.tmdbId != null) {
      const cached = input.tmdbCache?.get(input.tmdbId)
      if (cached) return { id: cached }

      const imported = await this.enrichmentService.importSeriesByTmdbId(input.tmdbId)
      if (imported) {
        input.tmdbCache?.set(input.tmdbId, imported.id)
        return imported
      }
      return null
    }

    if (input.prePassId !== undefined) {
      return input.prePassId ? { id: input.prePassId } : null
    }

    return null
  }

  /**
   * Ensures season and episode canonical records exist for the given coordinates.
   * Episode metadata (title, airDate, etc.) is accepted from the caller for the initial
   * record; MetadataEnrichmentService.enrichSeriesSeasons overwrites these with TMDB data.
   */
  async resolveEpisodeCanonical(input: ResolveEpisodeInput): Promise<{ id: string } | null> {
    let seasonId: string

    const [existingSeason] = await db
      .select({ id: seasons.id })
      .from(seasons)
      .where(and(eq(seasons.seriesId, input.seriesId), eq(seasons.seasonNumber, input.seasonNumber)))
      .limit(1)

    if (existingSeason) {
      seasonId = existingSeason.id
    } else {
      const inserted = await db
        .insert(seasons)
        .values({ seriesId: input.seriesId, seasonNumber: input.seasonNumber })
        .onConflictDoNothing()
        .returning({ id: seasons.id })

      if (inserted[0]) {
        seasonId = inserted[0].id
      } else {
        const [row] = await db
          .select({ id: seasons.id })
          .from(seasons)
          .where(and(eq(seasons.seriesId, input.seriesId), eq(seasons.seasonNumber, input.seasonNumber)))
          .limit(1)
        if (!row) return null
        seasonId = row.id
      }
    }

    const [existingEpisode] = await db
      .select({ id: episodes.id, posterPath: episodes.posterPath })
      .from(episodes)
      .where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, input.episodeNumber)))
      .limit(1)

    if (existingEpisode) {
      const poster = input.episodeMeta?.posterPath
      if (poster && !existingEpisode.posterPath) {
        await db
          .update(episodes)
          .set({ posterPath: poster })
          .where(eq(episodes.id, existingEpisode.id))
      }
      return { id: existingEpisode.id }
    }

    const { episodeMeta: m } = input
    const inserted = await db
      .insert(episodes)
      .values({
        seasonId,
        seriesId: input.seriesId,
        episodeNumber: input.episodeNumber,
        title: m?.title ?? null,
        synopsis: m?.synopsis ?? null,
        durationMinutes: m?.durationMinutes ?? null,
        airDate: m?.airDate ?? null,
        posterPath: m?.posterPath ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: episodes.id })

    if (inserted[0]) {
      if (this.onNewEpisode) this.onNewEpisode(inserted[0].id)
      return inserted[0]
    }

    const [row] = await db
      .select({ id: episodes.id })
      .from(episodes)
      .where(and(eq(episodes.seasonId, seasonId), eq(episodes.episodeNumber, input.episodeNumber)))
      .limit(1)
    return row ?? null
  }
}
