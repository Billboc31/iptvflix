import { eq, lt, sql } from 'drizzle-orm';
import { discoveryCandidate } from '../db/schema/index.js';
import { TmdbRateLimitError } from '../providers/metadata/tmdb/errors.js';
import { DISCOVERY_POOL_MAX_PAGES_PER_FEED } from '../config/env.js';
const CANDIDATE_TTL_DAYS = 7;
const FEED_PAGE_DELAY_MS = 250;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function expiresAtFromNow() {
    const d = new Date();
    d.setDate(d.getDate() + CANDIDATE_TTL_DAYS);
    return d;
}
export class DiscoveryCandidatePoolService {
    db;
    provider;
    externalDiscovery;
    constructor(db, provider, externalDiscovery) {
        this.db = db;
        this.provider = provider;
        this.externalDiscovery = externalDiscovery;
    }
    async refreshPool(feeds, mediaTypes) {
        for (const feed of feeds) {
            for (const mediaType of mediaTypes) {
                await this.refreshFeedType(feed, mediaType);
            }
        }
        await this.crossReferenceCanonicals();
    }
    async refreshFeedType(feed, mediaType) {
        for (let page = 1; page <= DISCOVERY_POOL_MAX_PAGES_PER_FEED; page++) {
            if (page > 1)
                await sleep(FEED_PAGE_DELAY_MS);
            let candidates;
            try {
                candidates =
                    mediaType === 'MOVIE'
                        ? await this.provider.fetchMovieFeed(feed, page)
                        : await this.provider.fetchSeriesFeed(feed, page);
            }
            catch (err) {
                if (!(err instanceof TmdbRateLimitError)) {
                    console.error(`Discovery feed error (${feed}/${mediaType} page ${page}):`, err);
                }
                break;
            }
            if (candidates.length === 0)
                break;
            const now = new Date();
            const expiresAt = expiresAtFromNow();
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
            }));
            await this.db
                .insert(discoveryCandidate)
                .values(rows)
                .onConflictDoUpdate({
                target: [discoveryCandidate.externalId, discoveryCandidate.mediaType],
                set: {
                    title: sql `excluded.title`,
                    year: sql `excluded.year`,
                    synopsis: sql `excluded.synopsis`,
                    posterPath: sql `excluded.poster_path`,
                    popularity: sql `excluded.popularity`,
                    voteAverage: sql `excluded.vote_average`,
                    releaseStatus: sql `excluded.release_status`,
                    provenance: sql `excluded.provenance`,
                    refreshedAt: sql `excluded.refreshed_at`,
                    expiresAt: sql `excluded.expires_at`,
                },
            });
        }
    }
    async crossReferenceCanonicals() {
        await this.db.execute(sql `
      UPDATE discovery_candidates dc
      SET canonical_movie_id = m.id
      FROM movies m
      WHERE dc.canonical_movie_id IS NULL
        AND dc.media_type = 'MOVIE'
        AND dc.external_id = m.tmdb_id::text
        AND m.tmdb_id IS NOT NULL
    `);
        await this.db.execute(sql `
      UPDATE discovery_candidates dc
      SET canonical_series_id = s.id
      FROM series s
      WHERE dc.canonical_series_id IS NULL
        AND dc.media_type = 'SERIES'
        AND dc.external_id = s.tmdb_id::text
        AND s.tmdb_id IS NOT NULL
    `);
    }
    async evictStale() {
        const deleted = await this.db
            .delete(discoveryCandidate)
            .where(lt(discoveryCandidate.expiresAt, new Date()))
            .returning({ id: discoveryCandidate.id });
        return deleted.length;
    }
    async materializeCandidate(candidateId) {
        const [candidate] = await this.db
            .select()
            .from(discoveryCandidate)
            .where(eq(discoveryCandidate.id, candidateId));
        if (!candidate) {
            throw new Error(`Discovery candidate not found: ${candidateId}`);
        }
        if (candidate.mediaType === 'MOVIE') {
            if (candidate.canonicalMovieId) {
                return { movie: { id: candidate.canonicalMovieId } };
            }
            const { id } = await this.externalDiscovery.materializeMovie(candidate.externalId);
            await this.db
                .update(discoveryCandidate)
                .set({ canonicalMovieId: id })
                .where(eq(discoveryCandidate.id, candidateId));
            return { movie: { id } };
        }
        else {
            if (candidate.canonicalSeriesId) {
                return { series: { id: candidate.canonicalSeriesId } };
            }
            const { id } = await this.externalDiscovery.materializeSeries(candidate.externalId);
            await this.db
                .update(discoveryCandidate)
                .set({ canonicalSeriesId: id })
                .where(eq(discoveryCandidate.id, candidateId));
            return { series: { id } };
        }
    }
}
//# sourceMappingURL=discovery-candidate-pool-service.js.map