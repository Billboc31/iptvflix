import { eq, gt, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { profiles, profileTaste, movies, series as seriesTbl, movieGenres, seriesGenres, movieAvailabilities, seriesAvailabilities, viewingProgress, discoveryCandidate, } from '../db/schema/index.js';
import { NotFoundError } from '../errors.js';
export async function rankRecommendations(profileId, opts = {}) {
    const { availableToMe = false, availabilityPolicy, includeSeen = false, limit = 20 } = opts;
    const clampedLimit = Math.min(Math.max(limit, 1), 100);
    const [profileRows, tasteRows, movieRows, seriesRows, movieGenreRows, seriesGenreRows, discoveryCandidateRows, movieAvailabilityRows, seriesAvailabilityRows, progressRows,] = await Promise.all([
        db.select({ id: profiles.id }).from(profiles).where(eq(profiles.id, profileId)),
        db.select().from(profileTaste).where(eq(profileTaste.profileId, profileId)),
        db.select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath, status: movies.status }).from(movies),
        db.select({ id: seriesTbl.id, title: seriesTbl.title, year: seriesTbl.firstAirYear, posterPath: seriesTbl.posterPath, status: seriesTbl.status }).from(seriesTbl),
        db.select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId }).from(movieGenres),
        db.select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId }).from(seriesGenres),
        db.select().from(discoveryCandidate).where(gt(discoveryCandidate.expiresAt, new Date())),
        db.select({ movieId: movieAvailabilities.movieId }).from(movieAvailabilities).where(eq(movieAvailabilities.status, 'AVAILABLE')),
        db.select({ seriesId: seriesAvailabilities.seriesId }).from(seriesAvailabilities).where(eq(seriesAvailabilities.status, 'AVAILABLE')),
        db
            .select({
            mediaId: viewingProgress.mediaId,
            progressSeconds: viewingProgress.progressSeconds,
            durationSeconds: viewingProgress.durationSeconds,
        })
            .from(viewingProgress)
            .where(and(eq(viewingProgress.profileId, profileId), eq(viewingProgress.mediaType, 'MOVIE'))),
    ]);
    if (profileRows.length === 0)
        throw new NotFoundError('Profile', profileId);
    const tasteRow = tasteRows[0];
    const coldStart = !tasteRow || tasteRow.signalCount === 0;
    const genreScores = (tasteRow?.genreScores ?? {});
    const genreMeta = (tasteRow?.genreMeta ?? {});
    const positiveMediaIds = new Set([...(tasteRow?.positiveMediaIds ?? []), ...(opts.positiveMediaIds ?? [])]);
    const negativeMediaIds = new Set(tasteRow?.negativeMediaIds ?? []);
    const preferGenreSet = new Set(opts.preferGenreIds ?? []);
    const movieGenreMap = new Map();
    for (const { movieId, genreId } of movieGenreRows) {
        const list = movieGenreMap.get(movieId) ?? [];
        list.push(genreId);
        movieGenreMap.set(movieId, list);
    }
    const seriesGenreMap = new Map();
    for (const { seriesId, genreId } of seriesGenreRows) {
        const list = seriesGenreMap.get(seriesId) ?? [];
        list.push(genreId);
        seriesGenreMap.set(seriesId, list);
    }
    const availableMovieIds = new Set(movieAvailabilityRows.map((r) => r.movieId));
    const availableSeriesIds = new Set(seriesAvailabilityRows.map((r) => r.seriesId));
    const completedMovieIds = new Set();
    for (const row of progressRows) {
        if (row.durationSeconds > 0 && row.progressSeconds / row.durationSeconds >= 0.9) {
            completedMovieIds.add(row.mediaId);
        }
    }
    const candidates = [];
    const localMovieIds = new Set();
    const localSeriesIds = new Set();
    if (!opts.mediaType || opts.mediaType === 'MOVIE') {
        for (const m of movieRows) {
            localMovieIds.add(m.id);
            candidates.push({
                mediaId: m.id,
                title: m.title,
                year: m.year,
                posterPath: m.posterPath,
                mediaType: 'MOVIE',
                source: 'LOCAL',
                genreIds: movieGenreMap.get(m.id) ?? [],
                popularity: null,
                voteAverage: null,
                status: m.status ?? null,
            });
        }
    }
    if (!opts.mediaType || opts.mediaType === 'SERIES') {
        for (const s of seriesRows) {
            localSeriesIds.add(s.id);
            candidates.push({
                mediaId: s.id,
                title: s.title,
                year: s.year,
                posterPath: s.posterPath,
                mediaType: 'SERIES',
                source: 'LOCAL',
                genreIds: seriesGenreMap.get(s.id) ?? [],
                popularity: null,
                voteAverage: null,
                status: s.status ?? null,
            });
        }
    }
    for (const dc of discoveryCandidateRows) {
        const dcMediaType = dc.mediaType;
        if (opts.mediaType && dcMediaType !== opts.mediaType)
            continue;
        if (dcMediaType === 'MOVIE' && dc.canonicalMovieId && localMovieIds.has(dc.canonicalMovieId))
            continue;
        if (dcMediaType === 'SERIES' && dc.canonicalSeriesId && localSeriesIds.has(dc.canonicalSeriesId))
            continue;
        const effectiveMediaId = dcMediaType === 'MOVIE' ? (dc.canonicalMovieId ?? dc.id) : (dc.canonicalSeriesId ?? dc.id);
        const genreIds = dcMediaType === 'MOVIE'
            ? (dc.canonicalMovieId ? (movieGenreMap.get(dc.canonicalMovieId) ?? []) : [])
            : (dc.canonicalSeriesId ? (seriesGenreMap.get(dc.canonicalSeriesId) ?? []) : []);
        candidates.push({
            mediaId: effectiveMediaId,
            title: dc.title,
            year: dc.year,
            posterPath: dc.posterPath,
            mediaType: dcMediaType,
            source: 'DISCOVERY',
            genreIds,
            popularity: dc.popularity,
            voteAverage: dc.voteAverage,
            status: null,
        });
    }
    const filtered = candidates.filter((c) => !negativeMediaIds.has(c.mediaId));
    const scored = filtered.map((c) => {
        const available = c.mediaType === 'MOVIE' ? availableMovieIds.has(c.mediaId) : availableSeriesIds.has(c.mediaId);
        const isCompletedMovie = c.mediaType === 'MOVIE' && completedMovieIds.has(c.mediaId);
        const seenPenalty = isCompletedMovie && !includeSeen ? -10.0 : 0;
        let score;
        let reasons;
        const preferGenreBonus = preferGenreSet.size > 0 && c.genreIds.some((gId) => preferGenreSet.has(gId)) ? 3.0 : 0;
        if (coldStart) {
            score = (c.popularity ?? 0) * (c.voteAverage ?? 0) + preferGenreBonus;
            reasons = ['popular pick'];
        }
        else {
            const genreAffinity = c.genreIds.reduce((sum, gId) => sum + (genreScores[gId] ?? 0), 0);
            const positiveBonus = positiveMediaIds.has(c.mediaId) ? 5.0 : 0;
            score = genreAffinity + positiveBonus + seenPenalty + preferGenreBonus;
            const matchedGenreNames = [];
            for (const gId of c.genreIds) {
                const gs = genreScores[gId];
                if (gs != null && gs > 0) {
                    const meta = genreMeta[gId];
                    if (meta)
                        matchedGenreNames.push(meta.name);
                }
            }
            if (positiveMediaIds.has(c.mediaId)) {
                reasons = ['liked', ...matchedGenreNames];
            }
            else if (matchedGenreNames.length > 0) {
                reasons = matchedGenreNames;
            }
            else {
                reasons = ['discovery'];
            }
        }
        return { ...c, score, reasons, available };
    });
    const UPCOMING_STATUSES = new Set(['Rumored', 'Planned', 'In Production', 'Post Production']);
    let visible;
    if (availabilityPolicy === 'WATCH_NOW') {
        visible = scored.filter((c) => c.available);
    }
    else if (availabilityPolicy === 'UPCOMING') {
        visible = scored.filter((c) => c.status != null && UPCOMING_STATUSES.has(c.status));
    }
    else {
        // ALL, DISCOVERY, undefined — fall back to legacy availableToMe flag
        visible = availableToMe ? scored.filter((c) => c.available) : scored;
    }
    visible.sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        return a.mediaId.localeCompare(b.mediaId);
    });
    const limited = visible.slice(0, clampedLimit);
    const outputCandidates = limited.map((c) => ({
        mediaType: c.mediaType,
        mediaId: c.mediaId,
        title: c.title,
        year: c.year,
        posterPath: c.posterPath,
        score: c.score,
        reasons: c.reasons,
        source: c.source,
        available: c.available,
    }));
    return {
        profileId,
        coldStart,
        candidates: outputCandidates,
    };
}
// ─────────────────────────────────────────────────────────────────────────────
// Hybrid ranking — pure, no DB access
// ─────────────────────────────────────────────────────────────────────────────
export const SCORE_MODEL_V1 = {
    version: 'v1',
    wSemantic: 0.35,
    wGenre: 0.25,
    wTheme: 0.15,
    wPeople: 0.10,
    wFreshness: 0.05,
    wPrior: 0.10,
    wAvailability: 0.05,
};
function getBlendedWeights(model, level) {
    if (level === 'explore') {
        return {
            wSemantic: model.wSemantic * 1.3,
            wGenre: model.wGenre * 0.5,
            wTheme: model.wTheme * 0.5,
            wPeople: model.wPeople * 0.5,
            wFreshness: model.wFreshness,
            wPrior: model.wPrior * 1.5,
            wAvailability: model.wAvailability,
        };
    }
    if (level === 'discover') {
        // weights sum to 1.0: 0.64+0.02+0.02+0.02+0.05+0.20+0.05
        return {
            wSemantic: 0.64,
            wGenre: 0.02,
            wTheme: 0.02,
            wPeople: 0.02,
            wFreshness: model.wFreshness,
            wPrior: model.wPrior * 2,
            wAvailability: model.wAvailability,
        };
    }
    return { ...model };
}
// ─── hard filters ─────────────────────────────────────────────────────────────
function passesHardFilters(c, queryPlan, availabilityPolicy) {
    const { hardFilters, mediaTypes } = queryPlan;
    if (mediaTypes.length > 0 && mediaTypes.length < 2 && !mediaTypes.includes(c.mediaType))
        return false;
    if (hardFilters.maxRuntimeMinutes != null && c.durationMinutes != null) {
        if (c.durationMinutes > hardFilters.maxRuntimeMinutes)
            return false;
    }
    if (hardFilters.minReleaseYear != null && c.year != null && c.year < hardFilters.minReleaseYear)
        return false;
    if (hardFilters.maxReleaseYear != null && c.year != null && c.year > hardFilters.maxReleaseYear)
        return false;
    if (hardFilters.includeGenres && hardFilters.includeGenres.length > 0) {
        const genreSet = new Set(c.genreIds);
        if (!hardFilters.includeGenres.some((g) => genreSet.has(g)))
            return false;
    }
    if (hardFilters.excludeGenres && hardFilters.excludeGenres.length > 0) {
        const genreSet = new Set(c.genreIds);
        if (hardFilters.excludeGenres.some((g) => genreSet.has(g)))
            return false;
    }
    if (hardFilters.audioLanguages &&
        hardFilters.audioLanguages.length > 0 &&
        c.originalLanguage != null) {
        if (!hardFilters.audioLanguages.includes(c.originalLanguage))
            return false;
    }
    if (availabilityPolicy === 'WATCH_NOW' && !c.available)
        return false;
    return true;
}
// ─── score components ─────────────────────────────────────────────────────────
function normalizeGenreAffinity(genreIds, genreScores) {
    if (genreIds.length === 0)
        return 0;
    const allPositive = Object.values(genreScores).filter((s) => s > 0);
    const maxScore = allPositive.length > 0 ? Math.max(...allPositive) : 1;
    const total = genreIds.reduce((sum, gId) => sum + Math.max(0, genreScores[gId] ?? 0) / maxScore, 0);
    return Math.min(1.0, total / genreIds.length);
}
function computeThemeAffinity(c, desiredThemes, desiredTone) {
    const signals = [...desiredThemes, ...desiredTone];
    if (signals.length === 0)
        return 0.5;
    const signalSet = signals.map((s) => s.toLowerCase());
    const candidateTerms = [
        ...c.keywords.map((k) => k.toLowerCase()),
        ...c.genreNames.map((g) => g.toLowerCase()),
    ];
    if (candidateTerms.length === 0)
        return 0.5;
    const matches = signalSet.filter((signal) => candidateTerms.some((term) => term.includes(signal) || signal.includes(term)));
    return Math.min(1.0, matches.length / signals.length);
}
function computePeopleAffinity(c, preferredDirectors) {
    if (!preferredDirectors || preferredDirectors.length === 0 || c.directors.length === 0) {
        return { score: 0.5, matchedPerson: null };
    }
    const prefSet = new Set(preferredDirectors.map((d) => d.toLowerCase()));
    const matched = c.directors.find((d) => prefSet.has(d.toLowerCase()));
    if (matched)
        return { score: 1.0, matchedPerson: matched };
    return { score: 0.5, matchedPerson: null };
}
function computeFreshness(year) {
    if (year == null)
        return 0.5;
    const currentYear = new Date().getFullYear();
    return Math.max(0, Math.min(1.0, 1 - (currentYear - year) / 20));
}
function computeQualityPrior(popularity, voteAverage) {
    const normPop = popularity != null ? Math.min(1.0, popularity / 100) : 0.3;
    const normVote = voteAverage != null ? voteAverage / 10 : 0.5;
    return normPop * 0.4 + normVote * 0.6;
}
function computeAvoidPenalty(c, avoidSignals) {
    if (avoidSignals.length === 0)
        return 0;
    const avoidLower = avoidSignals.map((s) => s.toLowerCase());
    const terms = [
        ...c.keywords.map((k) => k.toLowerCase()),
        ...c.genreNames.map((g) => g.toLowerCase()),
    ];
    const hasMatch = avoidLower.some((signal) => terms.some((term) => term.includes(signal) || signal.includes(term)));
    return hasMatch ? 0.2 : 0;
}
function buildReasons(components, genreNames, matchedPerson) {
    const reasons = [];
    if (components.semantic > 0.7)
        reasons.push('strong semantic match');
    else if (components.semantic > 0.5)
        reasons.push('semantic match');
    if (components.genreAffinity > 0.6 && genreNames.length > 0) {
        reasons.push(`strong ${genreNames[0].toLowerCase()} genre affinity`);
    }
    else if (components.genreAffinity > 0.3 && genreNames.length > 0) {
        reasons.push(`${genreNames[0].toLowerCase()} genre affinity`);
    }
    if (components.themeAffinity > 0.7)
        reasons.push('strong theme match');
    else if (components.themeAffinity > 0.55)
        reasons.push('theme match');
    if (matchedPerson)
        reasons.push(`liked ${matchedPerson} films`);
    if (components.freshness > 0.8)
        reasons.push('recent release');
    if (components.qualityPrior > 0.8)
        reasons.push('highly rated');
    if (components.availabilityBonus > 0)
        reasons.push('available now');
    if (components.alreadyWatchedPenalty > 0)
        reasons.push('already watched recently');
    if (components.abandonPenalty > 0)
        reasons.push('quick abandon penalty');
    if (components.dislikedPenalty > 0)
        reasons.push('disliked content');
    if (components.avoidPenalty > 0)
        reasons.push('theme avoid match');
    if (reasons.length === 0)
        reasons.push('discovery');
    return reasons;
}
// ─── diversity ────────────────────────────────────────────────────────────────
function applyDiversityFilter(scored, limit, maxPerCollection, maxPerDirector) {
    const collCount = new Map();
    const dirCount = new Map();
    const result = [];
    const deferred = [];
    for (const c of scored) {
        if (result.length >= limit) {
            deferred.push(c);
            continue;
        }
        const collId = c.collectionId;
        const dir = c.directors[0] ?? null;
        const collOk = !collId || (collCount.get(collId) ?? 0) < maxPerCollection;
        const dirOk = !dir || (dirCount.get(dir) ?? 0) < maxPerDirector;
        if (collOk && dirOk) {
            result.push(c);
            if (collId)
                collCount.set(collId, (collCount.get(collId) ?? 0) + 1);
            if (dir)
                dirCount.set(dir, (dirCount.get(dir) ?? 0) + 1);
        }
        else {
            deferred.push(c);
        }
    }
    const remaining = limit - result.length;
    if (remaining > 0) {
        result.push(...deferred.slice(0, remaining));
    }
    return result;
}
// ─── main export ──────────────────────────────────────────────────────────────
export function rankHybrid(candidates, queryPlan, taste, opts = {}) {
    const { limit = 24, availabilityPolicy, explorationLevel = 'exploit', diversityEnabled = true, maxPerCollection = 2, maxPerDirector = 3, alreadyShownIds = [], debug = false, includeSeen = false, } = opts;
    const weights = getBlendedWeights(SCORE_MODEL_V1, explorationLevel);
    const allGenreScores = taste?.genreScores ?? {};
    const shownSet = new Set(alreadyShownIds);
    const clampedLimit = Math.min(Math.max(1, limit), 500);
    // 1. Eligibility hard filters
    const eligible = candidates.filter((c) => passesHardFilters(c, queryPlan, availabilityPolicy));
    // 2. Score
    const scored = eligible.map((c) => {
        const isNegative = taste?.negativeMediaIds.has(c.mediaId) ?? false;
        const isCompleted = !includeSeen && c.completionRatio != null && c.completionRatio >= 0.9;
        const isAbandoned = c.completionRatio != null && c.completionRatio > 0 && c.completionRatio < 0.2;
        const semantic = c.similarity;
        const genreAffinity = normalizeGenreAffinity(c.genreIds, allGenreScores);
        const themeAffinity = computeThemeAffinity(c, queryPlan.desiredThemes, queryPlan.desiredTone);
        const peopleResult = computePeopleAffinity(c, queryPlan.softPreferences?.preferredDirectors);
        const fresh = computeFreshness(c.year);
        const prior = computeQualityPrior(c.popularity, c.voteAverage);
        const availBonus = c.available ? 1.0 : 0.0;
        const watchedPenalty = isCompleted ? 0.3 : 0;
        const abandonPenalty = isAbandoned ? 0.1 : 0;
        const dislikePenalty = isNegative ? 1.5 : 0;
        const avoidPenalty = computeAvoidPenalty(c, queryPlan.avoidSignals);
        const shownPenalty = shownSet.has(c.mediaId) ? 0.15 : 0;
        const repetitionPenalty = shownPenalty;
        const weighted = semantic * weights.wSemantic +
            genreAffinity * weights.wGenre +
            themeAffinity * weights.wTheme +
            peopleResult.score * weights.wPeople +
            fresh * weights.wFreshness +
            prior * weights.wPrior +
            availBonus * weights.wAvailability;
        const finalScore = weighted - watchedPenalty - abandonPenalty - dislikePenalty - avoidPenalty - shownPenalty;
        const reasons = buildReasons({
            semantic,
            genreAffinity,
            themeAffinity,
            qualityPrior: prior,
            freshness: fresh,
            availabilityBonus: availBonus,
            alreadyWatchedPenalty: watchedPenalty,
            abandonPenalty,
            dislikedPenalty: dislikePenalty,
            avoidPenalty,
            repetitionPenalty,
        }, c.genreNames, peopleResult.matchedPerson);
        const scoreBreakdown = debug
            ? {
                modelVersion: SCORE_MODEL_V1.version,
                semantic,
                genreAffinity,
                themeAffinity,
                peopleAffinity: peopleResult.score,
                qualityPrior: prior,
                freshness: fresh,
                availabilityBonus: availBonus,
                alreadyWatchedPenalty: watchedPenalty,
                abandonPenalty,
                dislikedPenalty: dislikePenalty,
                avoidPenalty,
                repetitionPenalty,
                final: finalScore,
                reasons,
            }
            : undefined;
        return { ...c, score: finalScore, reasons, scoreBreakdown };
    });
    // 3. Sort descending; mediaId as stable tiebreaker
    scored.sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        return a.mediaId.localeCompare(b.mediaId);
    });
    // 4. Diversity
    if (diversityEnabled) {
        return applyDiversityFilter(scored, clampedLimit, maxPerCollection, maxPerDirector);
    }
    return scored.slice(0, clampedLimit);
}
//# sourceMappingURL=recommendation-ranking-service.js.map