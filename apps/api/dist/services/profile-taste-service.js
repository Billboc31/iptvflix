import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profileTaste, explicitFeedback, viewingProgress, watchlist, episodes, movieGenres, seriesGenres, genres, } from '../db/schema/index.js';
export const SIGNAL_WEIGHTS = {
    LIKE: 3,
    DISLIKE: -3,
    NOT_INTERESTED: -2,
    COMPLETED_VIEW: 1,
    IN_PROGRESS_VIEW: 0.5,
    WATCHLIST: 0.5,
};
async function loadGenres(mediaType, mediaId) {
    if (mediaType === 'MOVIE') {
        return db
            .select({ id: genres.id, slug: genres.slug, name: genres.name })
            .from(movieGenres)
            .innerJoin(genres, eq(movieGenres.genreId, genres.id))
            .where(eq(movieGenres.movieId, mediaId));
    }
    return db
        .select({ id: genres.id, slug: genres.slug, name: genres.name })
        .from(seriesGenres)
        .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
        .where(eq(seriesGenres.seriesId, mediaId));
}
function buildOutput(profileId, genreScoresMap, genreMetaMap, positiveMediaIds, negativeMediaIds, signalCount, builtAt) {
    const genreScores = Object.entries(genreScoresMap)
        .filter(([, score]) => score !== 0)
        .map(([genreId, score]) => ({
        genreId,
        slug: genreMetaMap[genreId]?.slug ?? '',
        name: genreMetaMap[genreId]?.name ?? '',
        score,
    }))
        .sort((a, b) => b.score - a.score || a.genreId.localeCompare(b.genreId));
    return {
        profileId,
        genreScores,
        positiveMediaIds,
        negativeMediaIds,
        signalCount,
        builtAt: builtAt.toISOString(),
    };
}
export async function buildTaste(profileId) {
    const now = new Date();
    const [feedbackRows, progressRows, watchlistRows] = await Promise.all([
        db.select().from(explicitFeedback).where(eq(explicitFeedback.profileId, profileId)),
        db.select().from(viewingProgress).where(eq(viewingProgress.profileId, profileId)),
        db.select().from(watchlist).where(eq(watchlist.profileId, profileId)),
    ]);
    const genreScoresMap = {};
    const genreMetaMap = {};
    const positiveSet = new Set();
    const negativeSet = new Set();
    let signalCount = 0;
    function accumulate(genreRows, weight) {
        for (const g of genreRows) {
            genreScoresMap[g.id] = (genreScoresMap[g.id] ?? 0) + weight;
            genreMetaMap[g.id] = { slug: g.slug, name: g.name };
        }
    }
    for (const fb of feedbackRows) {
        const weight = SIGNAL_WEIGHTS[fb.feedback];
        const mediaType = fb.mediaType;
        accumulate(await loadGenres(mediaType, fb.mediaId), weight);
        if (fb.feedback === 'LIKE') {
            positiveSet.add(fb.mediaId);
        }
        else {
            negativeSet.add(fb.mediaId);
        }
        signalCount++;
    }
    for (const vp of progressRows) {
        if (vp.durationSeconds <= 0)
            continue;
        const ratio = vp.progressSeconds / vp.durationSeconds;
        if (ratio < 0.05)
            continue;
        const weight = ratio >= 0.9 ? SIGNAL_WEIGHTS.COMPLETED_VIEW : SIGNAL_WEIGHTS.IN_PROGRESS_VIEW;
        const isCompleted = ratio >= 0.9;
        let resolvedType;
        let resolvedId;
        if (vp.mediaType === 'MOVIE') {
            resolvedType = 'MOVIE';
            resolvedId = vp.mediaId;
        }
        else {
            const [ep] = await db
                .select({ seriesId: episodes.seriesId })
                .from(episodes)
                .where(eq(episodes.id, vp.mediaId));
            if (!ep)
                continue;
            resolvedType = 'SERIES';
            resolvedId = ep.seriesId;
        }
        accumulate(await loadGenres(resolvedType, resolvedId), weight);
        if (isCompleted)
            positiveSet.add(resolvedId);
        signalCount++;
    }
    for (const wl of watchlistRows) {
        const mediaType = wl.mediaType;
        accumulate(await loadGenres(mediaType, wl.mediaId), SIGNAL_WEIGHTS.WATCHLIST);
        signalCount++;
    }
    const sortedPositive = [...positiveSet].sort();
    const sortedNegative = [...negativeSet].sort();
    await db
        .insert(profileTaste)
        .values({
        profileId,
        genreScores: genreScoresMap,
        genreMeta: genreMetaMap,
        positiveMediaIds: sortedPositive,
        negativeMediaIds: sortedNegative,
        signalCount,
        builtAt: now,
    })
        .onConflictDoUpdate({
        target: profileTaste.profileId,
        set: {
            genreScores: genreScoresMap,
            genreMeta: genreMetaMap,
            positiveMediaIds: sortedPositive,
            negativeMediaIds: sortedNegative,
            signalCount,
            builtAt: now,
        },
    });
    return buildOutput(profileId, genreScoresMap, genreMetaMap, sortedPositive, sortedNegative, signalCount, now);
}
export async function getTaste(profileId) {
    const [row] = await db
        .select()
        .from(profileTaste)
        .where(eq(profileTaste.profileId, profileId));
    if (!row) {
        return buildTaste(profileId);
    }
    return buildOutput(profileId, row.genreScores, row.genreMeta, row.positiveMediaIds, row.negativeMediaIds, row.signalCount, row.builtAt);
}
//# sourceMappingURL=profile-taste-service.js.map