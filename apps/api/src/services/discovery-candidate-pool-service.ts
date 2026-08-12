import { eq, lt, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { discoveryCandidate } from '../db/schema/index.js'
import type { DiscoveryFeed, MetadataCandidate, MetadataProvider } from '../providers/metadata/types.js'
import { TmdbRateLimitError } from '../providers/metadata/tmdb/errors.js'
import type { ExternalDiscoveryService } from './external-discovery-service.js'

type Db = PostgresJsDatabase<typeof schema>

const CANDIDATE_TTL_DAYS = 7
const MAX_PAGES_PER_FEED = 3
const FEED_PAGE_DELAY_MS = 250

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function expiresAtFromNow(): Date {
  const d = new Date()
  d.setDate(d.getDate() + CANDIDATE_TTL_DAYS)
  return d
}

export class DiscoveryCandidatePoolService {
  constructor(
    private readonly db: Db,
    private readonly provider: MetadataProvider,
    private readonly externalDiscovery: ExternalDiscoveryService,
  ) {}

  async refreshPool(feeds: DiscoveryFeed[], mediaTypes: ('MOVIE' | 'SERIES')[]): Promise<void> {
    for (const feed of feeds) {
      for (const mediaType of mediaTypes) {
        await this.refreshFeedType(feed, mediaType)
      }
    }
    await this.crossReferenceCanonicals()
  }

  private async refreshFeedType(feed: DiscoveryFeed, mediaType: 'MOVIE' | 'SERIES'): Promise<void> {
    for (let page = 1; page <= MAX_PAGES_PER_FEED; page++) {
      if (page > 1) await sleep(FEED_PAGE_DELAY_MS)

      let candidates: MetadataCandidate[]
      try {
        candidates =
          mediaType === 'MOVIE'
            ? await this.provider.fetchMovieFeed(feed, page)
            : await this.provider.fetchSeriesFeed(feed, page)
      } catch (err) {
        if (!(err instanceof TmdbRateLimitError)) {
          console.error(`Discovery feed error (${feed}/${mediaType} page ${page}):`, err)
        }
        break
      }

      if (candidates.length === 0) break

      const now = new Date()
      const expiresAt = expiresAtFromNow()

      const rows = candidates.map((c) => ({
        externalId: c.externalId,
        mediaType: c.mediaType,
        title: c.title,
        year: c.year ?? null,
        synopsis: c.synopsis ?? null,
        posterPath: c.posterPath ?? null,
        popularity: c.popularity ?? null,
        voteAverage: c.voteAverage ?? null,
        releaseStatus: c.releaseStatus ?? null,
        provenance: feed,
        refreshedAt: now,
        expiresAt,
      }))

      await this.db
        .insert(discoveryCandidate)
        .values(rows)
        .onConflictDoUpdate({
          target: [discoveryCandidate.externalId, discoveryCandidate.mediaType],
          set: {
            title: sql`excluded.title`,
            year: sql`excluded.year`,
            synopsis: sql`excluded.synopsis`,
            posterPath: sql`excluded.poster_path`,
            popularity: sql`excluded.popularity`,
            voteAverage: sql`excluded.vote_average`,
            releaseStatus: sql`excluded.release_status`,
            provenance: sql`excluded.provenance`,
            refreshedAt: sql`excluded.refreshed_at`,
            expiresAt: sql`excluded.expires_at`,
          },
        })
    }
  }

  private async crossReferenceCanonicals(): Promise<void> {
    await this.db.execute(sql`
      UPDATE discovery_candidates dc
      SET canonical_movie_id = m.id
      FROM movies m
      WHERE dc.canonical_movie_id IS NULL
        AND dc.media_type = 'MOVIE'
        AND dc.external_id = m.tmdb_id::text
        AND m.tmdb_id IS NOT NULL
    `)
    await this.db.execute(sql`
      UPDATE discovery_candidates dc
      SET canonical_series_id = s.id
      FROM series s
      WHERE dc.canonical_series_id IS NULL
        AND dc.media_type = 'SERIES'
        AND dc.external_id = s.tmdb_id::text
        AND s.tmdb_id IS NOT NULL
    `)
  }

  async evictStale(): Promise<number> {
    const deleted = await this.db
      .delete(discoveryCandidate)
      .where(lt(discoveryCandidate.expiresAt, new Date()))
      .returning({ id: discoveryCandidate.id })
    return deleted.length
  }

  async materializeCandidate(
    candidateId: string,
  ): Promise<{ movie: { id: string } } | { series: { id: string } }> {
    const [candidate] = await this.db
      .select()
      .from(discoveryCandidate)
      .where(eq(discoveryCandidate.id, candidateId))

    if (!candidate) {
      throw new Error(`Discovery candidate not found: ${candidateId}`)
    }

    if (candidate.mediaType === 'MOVIE') {
      if (candidate.canonicalMovieId) {
        return { movie: { id: candidate.canonicalMovieId } }
      }
      const { id } = await this.externalDiscovery.materializeMovie(candidate.externalId)
      await this.db
        .update(discoveryCandidate)
        .set({ canonicalMovieId: id })
        .where(eq(discoveryCandidate.id, candidateId))
      return { movie: { id } }
    } else {
      if (candidate.canonicalSeriesId) {
        return { series: { id: candidate.canonicalSeriesId } }
      }
      const { id } = await this.externalDiscovery.materializeSeries(candidate.externalId)
      await this.db
        .update(discoveryCandidate)
        .set({ canonicalSeriesId: id })
        .where(eq(discoveryCandidate.id, candidateId))
      return { series: { id } }
    }
  }
}
