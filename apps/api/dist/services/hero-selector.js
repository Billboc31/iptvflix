import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { explicitFeedback, movies, series, mediaVideos } from '../db/schema/index.js';
import { resolveMediaImageUrl } from '../lib/tmdb-image.js';
import { HERO_MIN_SCORE, HERO_POOL_SIZE, HERO_SCORE_WEIGHTS } from '../config/env.js';
export function computeHeroScore(candidate, weights) {
    return (weights.profileRelevance * candidate.profileScore +
        weights.semanticConfidence * candidate.semanticScore +
        weights.qualityPrior * candidate.qualityPrior +
        weights.languageAffinity * candidate.languageAffinity);
}
export async function selectHero(profileId, candidates) {
    if (candidates.length === 0)
        return null;
    const pool = candidates.slice(0, HERO_POOL_SIZE);
    const eligibleCandidates = pool.filter((c) => c.available && c.finalScore >= HERO_MIN_SCORE);
    if (eligibleCandidates.length === 0)
        return null;
    const dislikedRows = await db
        .select({ mediaId: explicitFeedback.mediaId })
        .from(explicitFeedback)
        .where(and(eq(explicitFeedback.profileId, profileId), eq(explicitFeedback.feedback, 'DISLIKE')));
    const dislikedIds = new Set(dislikedRows.map((r) => r.mediaId));
    const nonDisliked = eligibleCandidates.filter((c) => !dislikedIds.has(c.mediaId));
    if (nonDisliked.length === 0)
        return null;
    const movieIds = nonDisliked.filter((c) => c.mediaType === 'MOVIE').map((c) => c.mediaId);
    const seriesIds = nonDisliked.filter((c) => c.mediaType === 'SERIES').map((c) => c.mediaId);
    const [movieRows, seriesRows, movieTrailers, seriesTrailers] = await Promise.all([
        movieIds.length > 0
            ? db
                .select({ id: movies.id, title: movies.title, synopsis: movies.synopsis, backdropPath: movies.backdropPath })
                .from(movies)
                .where(inArray(movies.id, movieIds))
            : Promise.resolve([]),
        seriesIds.length > 0
            ? db
                .select({ id: series.id, title: series.title, synopsis: series.synopsis, backdropPath: series.backdropPath })
                .from(series)
                .where(inArray(series.id, seriesIds))
            : Promise.resolve([]),
        movieIds.length > 0
            ? db
                .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
                .from(mediaVideos)
                .where(and(eq(mediaVideos.mediaType, 'movie'), inArray(mediaVideos.mediaId, movieIds)))
            : Promise.resolve([]),
        seriesIds.length > 0
            ? db
                .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
                .from(mediaVideos)
                .where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
            : Promise.resolve([]),
    ]);
    const enrichMap = new Map();
    for (const r of movieRows) {
        enrichMap.set(r.id, { title: r.title, synopsis: r.synopsis ?? null, backdropUrl: resolveMediaImageUrl(r.backdropPath), trailerKey: null });
    }
    for (const r of seriesRows) {
        enrichMap.set(r.id, { title: r.title, synopsis: r.synopsis ?? null, backdropUrl: resolveMediaImageUrl(r.backdropPath), trailerKey: null });
    }
    for (const r of [...movieTrailers, ...seriesTrailers]) {
        const entry = enrichMap.get(r.mediaId);
        if (entry && !entry.trailerKey)
            entry.trailerKey = r.youtubeKey;
    }
    const ranked = [];
    for (const candidate of nonDisliked) {
        const enrichment = enrichMap.get(candidate.mediaId);
        if (!enrichment?.title || !enrichment.backdropUrl)
            continue;
        const heroScore = computeHeroScore(candidate, HERO_SCORE_WEIGHTS);
        ranked.push({ candidate, enrichment, heroScore });
    }
    if (ranked.length === 0) {
        console.info(`[HERO_RANKING] profileId=${profileId} result=null reason=no_eligible_candidates`);
        return null;
    }
    ranked.sort((a, b) => b.heroScore - a.heroScore);
    const winner = ranked[0];
    console.info(`[HERO_RANKING] profileId=${profileId} pool=${pool.length} eligible=${ranked.length} ` +
        `winner=${winner.candidate.mediaId}(${winner.enrichment.title}) heroScore=${winner.heroScore.toFixed(3)} weights=${HERO_SCORE_WEIGHTS.version}`, {
        candidates: ranked.map((e, i) => ({
            rank: i + 1,
            mediaId: e.candidate.mediaId,
            title: e.enrichment.title,
            heroScore: e.heroScore,
            profile: e.candidate.profileScore,
            semantic: e.candidate.semanticScore,
            quality: e.candidate.qualityPrior,
            lang: e.candidate.languageAffinity,
            selected: i === 0,
        })),
    });
    return {
        mediaId: winner.candidate.mediaId,
        mediaType: winner.candidate.mediaType,
        title: winner.enrichment.title,
        synopsis: winner.enrichment.synopsis,
        backdropUrl: winner.enrichment.backdropUrl,
        availabilityStatus: 'AVAILABLE',
        trailerKey: winner.enrichment.trailerKey,
    };
}
//# sourceMappingURL=hero-selector.js.map