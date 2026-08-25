import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { shelves, shelfMembers, movies, series, movieGenres, seriesGenres, genres, mediaCredits, } from '../db/schema.js';
import { runRecommendationFromPlan } from '../pipeline/recommendation-service.js';
class ValidationError extends Error {
    constructor(message) { super(message); this.name = 'ValidationError'; }
}
class NotFoundError extends Error {
    constructor(resource, id) { super(`${resource} ${id} not found`); this.name = 'NotFoundError'; }
}
class ForbiddenError extends Error {
    constructor() { super('Forbidden'); this.name = 'ForbiddenError'; }
}
export { ValidationError, NotFoundError, ForbiddenError };
export async function buildSeedQueryPlan(seedMediaIds, mediaTypes) {
    const seedMovieIds = seedMediaIds.filter((s) => s.mediaType === 'MOVIE').map((s) => s.mediaId);
    const seedSeriesIds = seedMediaIds.filter((s) => s.mediaType === 'SERIES').map((s) => s.mediaId);
    const [movieRows, seriesRows, movieGenreRows, seriesGenreRows, genreRows, creditRows] = await Promise.all([
        seedMovieIds.length > 0
            ? db.select({ id: movies.id, title: movies.title, originalLanguage: movies.originalLanguage, year: movies.year, keywords: movies.keywords }).from(movies).where(inArray(movies.id, seedMovieIds))
            : Promise.resolve([]),
        seedSeriesIds.length > 0
            ? db.select({ id: series.id, title: series.title, originalLanguage: series.originalLanguage, year: series.firstAirYear, keywords: series.keywords }).from(series).where(inArray(series.id, seedSeriesIds))
            : Promise.resolve([]),
        seedMovieIds.length > 0
            ? db.select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId }).from(movieGenres).where(inArray(movieGenres.movieId, seedMovieIds))
            : Promise.resolve([]),
        seedSeriesIds.length > 0
            ? db.select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId }).from(seriesGenres).where(inArray(seriesGenres.seriesId, seedSeriesIds))
            : Promise.resolve([]),
        db.select({ id: genres.id, name: genres.name }).from(genres),
        [...seedMovieIds, ...seedSeriesIds].length > 0
            ? db.select({ mediaId: mediaCredits.mediaId, name: mediaCredits.name, role: mediaCredits.role }).from(mediaCredits).where(inArray(mediaCredits.mediaId, [...seedMovieIds, ...seedSeriesIds]))
            : Promise.resolve([]),
    ]);
    // Seed titles for explanation
    const movieById = new Map(movieRows.map((m) => [m.id, m]));
    const seriesById = new Map(seriesRows.map((s) => [s.id, s]));
    // Validate all requested seeds exist in the database
    for (const seed of seedMediaIds) {
        if (seed.mediaType === 'MOVIE' && !movieById.has(seed.mediaId)) {
            throw new ValidationError(`Seed not found: MOVIE:${seed.mediaId}`);
        }
        if (seed.mediaType === 'SERIES' && !seriesById.has(seed.mediaId)) {
            throw new ValidationError(`Seed not found: SERIES:${seed.mediaId}`);
        }
    }
    const seedTitles = seedMediaIds.map((s) => s.mediaType === 'MOVIE' ? (movieById.get(s.mediaId)?.title ?? '') : (seriesById.get(s.mediaId)?.title ?? '')).filter(Boolean);
    // Aggregate genre IDs by frequency
    const genreNameMap = new Map(genreRows.map((g) => [g.id, g.name]));
    const genreCount = new Map();
    for (const { genreId } of movieGenreRows)
        genreCount.set(genreId, (genreCount.get(genreId) ?? 0) + 1);
    for (const { genreId } of seriesGenreRows)
        genreCount.set(genreId, (genreCount.get(genreId) ?? 0) + 1);
    const sortedGenreEntries = [...genreCount.entries()].sort(([, a], [, b]) => b - a);
    const inferredGenreIds = sortedGenreEntries.map(([id]) => id);
    const topGenreNames = sortedGenreEntries.slice(0, 5).map(([id]) => genreNameMap.get(id)).filter(Boolean);
    // Aggregate keywords by frequency
    const keywordCount = new Map();
    for (const m of movieRows) {
        for (const kw of (m.keywords ?? []))
            keywordCount.set(kw, (keywordCount.get(kw) ?? 0) + 1);
    }
    for (const s of seriesRows) {
        for (const kw of (s.keywords ?? []))
            keywordCount.set(kw, (keywordCount.get(kw) ?? 0) + 1);
    }
    const topKeywords = [...keywordCount.entries()].sort(([, a], [, b]) => b - a).slice(0, 5).map(([k]) => k);
    // Aggregate directors
    const directors = creditRows.filter((c) => c.role === 'director').map((c) => c.name);
    const uniqueDirectors = [...new Set(directors)].slice(0, 3);
    // Dominant language
    const langCount = new Map();
    for (const m of movieRows)
        if (m.originalLanguage)
            langCount.set(m.originalLanguage, (langCount.get(m.originalLanguage) ?? 0) + 1);
    for (const s of seriesRows)
        if (s.originalLanguage)
            langCount.set(s.originalLanguage, (langCount.get(s.originalLanguage) ?? 0) + 1);
    const dominantLanguage = [...langCount.entries()].sort(([, a], [, b]) => b - a)[0]?.[0];
    // Dominant decade
    const allYears = [
        ...movieRows.map((m) => m.year),
        ...seriesRows.map((s) => s.year),
    ].filter((y) => y != null);
    const decadeCount = new Map();
    for (const year of allYears) {
        const decade = `${Math.floor(year / 10) * 10}s`;
        decadeCount.set(decade, (decadeCount.get(decade) ?? 0) + 1);
    }
    const topDecades = [...decadeCount.entries()].sort(([, a], [, b]) => b - a).slice(0, 2).map(([d]) => d);
    // Build semantic intent from aggregated seed attributes
    const parts = [];
    if (topGenreNames.length > 0)
        parts.push(`Genres : ${topGenreNames.join(', ')}`);
    if (topKeywords.length > 0)
        parts.push(`Thèmes : ${topKeywords.join(', ')}`);
    if (uniqueDirectors.length > 0)
        parts.push(`Réalisateurs : ${uniqueDirectors.join(', ')}`);
    if (dominantLanguage)
        parts.push(`Langue : ${dominantLanguage}`);
    if (topDecades.length > 0)
        parts.push(`Époques : ${topDecades.join(', ')}`);
    const plan = {
        schemaVersion: '1',
        rawQuery: '',
        displayTitle: 'Generated Shelf',
        semanticIntent: parts.join('. '),
        desiredThemes: topGenreNames.slice(0, 3),
        desiredTone: [],
        avoidSignals: [],
        mediaTypes: mediaTypes.map((t) => t.toUpperCase()),
        hardFilters: {},
        softPreferences: {
            preferredDecades: topDecades,
            preferredLanguages: dominantLanguage ? [dominantLanguage] : [],
        },
        userConstraints: [],
        plannerFallback: true,
        plannerMeta: null,
    };
    return { plan, inferredGenreIds, seedTitles };
}
async function resolveGeneratedMembers(profileId, seedMediaIds, opts, log) {
    const seedIdSet = new Set(seedMediaIds.map((s) => s.mediaId));
    const mediaTypes = opts.mediaType
        ? [opts.mediaType.toLowerCase()]
        : ['movie', 'series'];
    const { plan, inferredGenreIds, seedTitles } = await buildSeedQueryPlan(seedMediaIds, mediaTypes);
    // Request extra candidates to account for seed exclusion and availableToMe filtering
    const requestLimit = opts.limit + seedMediaIds.length + 40;
    const result = await runRecommendationFromPlan(plan, { profileId, mediaTypes, limit: requestLimit, candidatePoolSize: 200 }, `shelf-seeds-${profileId}`, log);
    // Post-filter: exclude seeds; availableToMe uses the `available` flag set by the reranker
    let candidates = result.results.filter((c) => !seedIdSet.has(c.id));
    if (opts.availableToMe) {
        candidates = candidates.filter((c) => c.available === true);
    }
    candidates = candidates.slice(0, opts.limit);
    const members = candidates.map((c) => ({
        mediaType: c.mediaType.toUpperCase(),
        mediaId: c.id,
    }));
    return { members, inferredGenreIds, seedTitles };
}
// ─── Public API ───────────────────────────────────────────────────────────────
export async function generateShelfFromSeeds(profileId, body, log) {
    const { title, seedMediaIds, mediaType, availableToMe, limit: rawLimit } = body;
    if (!Array.isArray(seedMediaIds) || seedMediaIds.length < 3 || seedMediaIds.length > 10) {
        throw new ValidationError('seedMediaIds must have between 3 and 10 entries');
    }
    const uniqueSeedIds = new Set(seedMediaIds.map((s) => s.mediaId));
    if (uniqueSeedIds.size !== seedMediaIds.length)
        throw new ValidationError('seedMediaIds must not contain duplicate mediaId values');
    const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100);
    const { members, inferredGenreIds, seedTitles } = await resolveGeneratedMembers(profileId, seedMediaIds, { mediaType, availableToMe, limit }, log);
    const generatedAt = new Date().toISOString();
    const rules = { seedMediaIds, mediaType, availableToMe, limit, inferredGenreIds, generatedAt };
    const shelf = await db.transaction(async (tx) => {
        const [{ maxPos }] = await tx.select({ maxPos: sql `coalesce(max(${shelves.position}), -1)` }).from(shelves).where(eq(shelves.profileId, profileId));
        const position = (maxPos ?? -1) + 1;
        const [inserted] = await tx.insert(shelves).values({ profileId, title, type: 'GENERATED', rules, position, layoutHint: 'ROW' }).returning();
        if (members.length > 0) {
            await tx.insert(shelfMembers).values(members.map((m, idx) => ({ shelfId: inserted.id, mediaType: m.mediaType, mediaId: m.mediaId, position: idx }))).onConflictDoNothing();
        }
        return inserted;
    });
    return {
        shelf: { id: shelf.id, title: shelf.title, type: 'GENERATED', layoutHint: shelf.layoutHint, position: shelf.position },
        explanation: { inferredGenreIds, seedTitles, generatedAt },
    };
}
export async function refreshGeneratedShelf(shelfId, profileId, log) {
    const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId));
    if (!shelf)
        throw new NotFoundError('Shelf', shelfId);
    if (shelf.profileId !== profileId)
        throw new ForbiddenError();
    if (shelf.type !== 'GENERATED')
        throw new ValidationError('Shelf is not a GENERATED shelf');
    const rules = shelf.rules;
    if (!rules?.seedMediaIds || !Array.isArray(rules.seedMediaIds) || rules.limit == null) {
        throw new ValidationError('Shelf has invalid or missing generation rules');
    }
    const { members, inferredGenreIds, seedTitles } = await resolveGeneratedMembers(profileId, rules.seedMediaIds, { mediaType: rules.mediaType, availableToMe: rules.availableToMe, limit: rules.limit }, log);
    const updatedRules = { ...rules, generatedAt: new Date().toISOString() };
    await db.transaction(async (tx) => {
        await tx.delete(shelfMembers).where(eq(shelfMembers.shelfId, shelfId));
        if (members.length > 0) {
            await tx.insert(shelfMembers).values(members.map((m, idx) => ({ shelfId, mediaType: m.mediaType, mediaId: m.mediaId, position: idx }))).onConflictDoNothing();
        }
        await tx.update(shelves).set({ rules: updatedRules, updatedAt: new Date() }).where(eq(shelves.id, shelfId));
    });
    return {
        shelf: { id: shelf.id, title: shelf.title, type: 'GENERATED', layoutHint: shelf.layoutHint, position: shelf.position },
        explanation: { inferredGenreIds, seedTitles, generatedAt: updatedRules.generatedAt },
    };
}
//# sourceMappingURL=shelf-generator.js.map