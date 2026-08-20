// @deprecated — use recommendation-engine (apps/recommendation-engine/src/pipeline/stages/semantic-search.ts)
import { inArray } from 'drizzle-orm';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
export class SemanticRetrievalService {
    db;
    embeddingService;
    constructor(db, embeddingService) {
        this.db = db;
        this.embeddingService = embeddingService;
    }
    async retrieve(queryText, topK = 10, queryTextOverride) {
        const embedText = queryTextOverride ?? queryText;
        const candidates = await this.embeddingService.semanticSearch(embedText, topK);
        return this.enrichWithMetadata(candidates);
    }
    async enrichWithMetadata(candidates) {
        if (candidates.length === 0)
            return [];
        const movieIds = candidates.filter((c) => c.mediaType === 'MOVIE').map((c) => c.mediaId);
        const seriesIds = candidates.filter((c) => c.mediaType === 'SERIES').map((c) => c.mediaId);
        const [movieRows, seriesRows] = await Promise.all([
            movieIds.length > 0
                ? this.db
                    .select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath })
                    .from(movies)
                    .where(inArray(movies.id, movieIds))
                : Promise.resolve([]),
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
                : Promise.resolve([]),
        ]);
        const movieMap = new Map(movieRows.map((r) => [r.id, r]));
        const seriesMap = new Map(seriesRows.map((r) => [r.id, r]));
        return candidates
            .map((c) => {
            const meta = c.mediaType === 'MOVIE' ? movieMap.get(c.mediaId) : seriesMap.get(c.mediaId);
            return {
                ...c,
                title: meta?.title ?? 'Unknown',
                year: meta?.year ?? null,
                posterPath: meta?.posterPath ?? null,
            };
        })
            .filter((r) => r.title !== 'Unknown' || candidates.some((c) => c.mediaId === r.mediaId));
    }
}
//# sourceMappingURL=semantic-retrieval-service.js.map