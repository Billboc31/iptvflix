import { eq, and, ne, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { titleMatchResults } from '../db/schema/title-match-results.js';
import { movies } from '../db/schema/movies.js';
import { series } from '../db/schema/series.js';
import { normalizeTitle } from '../matching/title-normalizer.js';
import { scoreCandidates, MATCH_THRESHOLD, AMBIGUITY_GAP, CANDIDATE_THRESHOLD, } from '../matching/candidate-scorer.js';
/** Punctuation-insensitive key so "Dune: Part Two" matches "Dune Part Two". */
export function catalogMatchKey(raw) {
    const { normalizedTitle } = normalizeTitle(raw);
    return normalizedTitle.replace(/[^a-z0-9àâäéèêëïîôùûüç\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}
function rowTitles(row) {
    return [row.title, row.originalTitle, row.frTitle].filter((t) => !!t && t.trim().length > 0);
}
function toLocalCandidates(rows, mediaType) {
    const out = [];
    for (const row of rows) {
        for (const title of rowTitles(row)) {
            out.push({
                externalId: row.id,
                title,
                year: row.year,
                mediaType,
            });
        }
    }
    return out;
}
function collapseScoredById(scored) {
    const best = new Map();
    for (const s of scored) {
        const id = s.candidate.externalId;
        const prev = best.get(id);
        if (!prev || s.rawScore > prev.rawScore)
            best.set(id, s);
    }
    return [...best.values()].sort((a, b) => b.rawScore - a.rawScore);
}
function buildMatchIndex(rows) {
    const index = new Map();
    for (const row of rows) {
        for (const title of rowTitles(row)) {
            const key = catalogMatchKey(title);
            if (!key)
                continue;
            const list = index.get(key) ?? [];
            if (!list.some((r) => r.id === row.id))
                list.push(row);
            index.set(key, list);
        }
    }
    return index;
}
async function loadAllLocalRows(mediaType) {
    if (mediaType === 'MOVIE') {
        return db
            .select({
            id: movies.id,
            title: movies.title,
            originalTitle: movies.originalTitle,
            year: movies.year,
            frTitle: sql `${movies.localizations} #>> '{fr,title}'`,
        })
            .from(movies);
    }
    return db
        .select({
        id: series.id,
        title: series.title,
        originalTitle: series.originalTitle,
        year: series.firstAirYear,
        frTitle: sql `${series.localizations} #>> '{fr,title}'`,
    })
        .from(series);
}
function toMatchResult(row) {
    return {
        id: row.id,
        providerId: row.providerId,
        providerItemId: row.providerItemId,
        matchState: row.matchState,
        confidence: row.confidence !== null ? parseFloat(row.confidence) : null,
        movieId: row.movieId ?? null,
        seriesId: row.seriesId ?? null,
        normalizedTitle: row.normalizedTitle,
        extractedYear: row.extractedYear ?? null,
        candidateCount: row.candidateCount,
        notes: row.notes ?? '',
    };
}
/**
 * Find or create a canonical movies row for the given TMDB candidate.
 * When not found by tmdbId, inserts a skeleton with matchStatus='MATCHED'
 * so that enrichment picks it up on its next run.
 */
async function resolveMovieId(candidate) {
    const tmdbId = parseInt(candidate.externalId, 10);
    if (isNaN(tmdbId))
        return null;
    const [existing] = await db.select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId));
    if (existing)
        return existing.id;
    // Not in DB — insert canonical skeleton so enrichment can populate full metadata
    const [inserted] = await db
        .insert(movies)
        .values({
        title: candidate.title,
        year: candidate.year ?? null,
        tmdbId,
        matchStatus: 'MATCHED',
    })
        .onConflictDoNothing({ target: movies.tmdbId })
        .returning({ id: movies.id });
    if (inserted)
        return inserted.id;
    // Concurrent insert — re-query
    const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId));
    return row?.id ?? null;
}
/**
 * Find or create a canonical series row for the given TMDB candidate.
 */
async function resolveSeriesId(candidate) {
    const tmdbId = parseInt(candidate.externalId, 10);
    if (isNaN(tmdbId))
        return null;
    const [existing] = await db.select({ id: series.id }).from(series).where(eq(series.tmdbId, tmdbId));
    if (existing)
        return existing.id;
    const [inserted] = await db
        .insert(series)
        .values({
        title: candidate.title,
        firstAirYear: candidate.year ?? null,
        tmdbId,
        matchStatus: 'MATCHED',
    })
        .onConflictDoNothing({ target: series.tmdbId })
        .returning({ id: series.id });
    if (inserted)
        return inserted.id;
    const [row] = await db.select({ id: series.id }).from(series).where(eq(series.tmdbId, tmdbId));
    return row?.id ?? null;
}
export class TitleMatchingService {
    metadataProvider;
    constructor(metadataProvider) {
        this.metadataProvider = metadataProvider;
    }
    movieIndex = null;
    seriesIndex = null;
    async localIndex(mediaType) {
        if (mediaType === 'MOVIE') {
            if (!this.movieIndex)
                this.movieIndex = buildMatchIndex(await loadAllLocalRows('MOVIE'));
            return this.movieIndex;
        }
        if (!this.seriesIndex)
            this.seriesIndex = buildMatchIndex(await loadAllLocalRows('SERIES'));
        return this.seriesIndex;
    }
    async matchItem(input) {
        // Step 1: Guard — do not re-evaluate a confirmed match
        const [existing] = await db
            .select()
            .from(titleMatchResults)
            .where(and(eq(titleMatchResults.providerId, input.providerId), eq(titleMatchResults.providerItemId, input.providerItemId), eq(titleMatchResults.mediaType, input.mediaType)));
        if (existing?.matchState === 'MATCHED') {
            return toMatchResult(existing);
        }
        // Step 2: Normalize
        const { normalizedTitle, extractedYear } = normalizeTitle(input.rawTitle);
        const effectiveYear = extractedYear ?? input.providerYear ?? null;
        const scoreInput = {
            normalizedTitle,
            extractedYear,
            providerYear: input.providerYear,
            mediaType: input.mediaType,
        };
        const decide = (scored) => {
            const top = scored[0];
            const second = scored[1];
            const top1Raw = top ? top.rawScore : 0;
            const top2Raw = second ? second.rawScore : 0;
            const rawGap = top1Raw - top2Raw;
            let matchState;
            if (top && top.confidence >= MATCH_THRESHOLD && (scored.length === 1 || rawGap >= AMBIGUITY_GAP)) {
                matchState = 'MATCHED';
            }
            else if (top && top.confidence >= CANDIDATE_THRESHOLD) {
                matchState = 'AMBIGUOUS';
            }
            else {
                matchState = 'UNMATCHED';
            }
            return { top, second, rawGap, matchState };
        };
        // Step 3: Local catalog first — no TMDB if a unique high-confidence row already exists
        const index = await this.localIndex(input.mediaType);
        const localRows = index.get(catalogMatchKey(input.rawTitle)) ?? [];
        const localScored = collapseScoredById(scoreCandidates(scoreInput, toLocalCandidates(localRows, input.mediaType)));
        const localDecision = decide(localScored);
        let matchState = localDecision.matchState;
        let top = localDecision.top;
        let second = localDecision.second;
        let rawGap = localDecision.rawGap;
        let candidates = toLocalCandidates(localRows, input.mediaType);
        let movieId = null;
        let seriesId = null;
        let source = 'local';
        if (matchState === 'MATCHED' && top) {
            if (input.mediaType === 'MOVIE')
                movieId = top.candidate.externalId;
            else
                seriesId = top.candidate.externalId;
        }
        else {
            // Step 4: Fall back to TMDB search when local miss or ambiguous
            source = 'tmdb';
            candidates =
                input.mediaType === 'MOVIE'
                    ? await this.metadataProvider.searchMovies(normalizedTitle, effectiveYear)
                    : await this.metadataProvider.searchSeries(normalizedTitle, effectiveYear);
            const scored = scoreCandidates(scoreInput, candidates);
            const remote = decide(scored);
            matchState = remote.matchState;
            top = remote.top;
            second = remote.second;
            rawGap = remote.rawGap;
            if (matchState === 'MATCHED' && top) {
                if (input.mediaType === 'MOVIE') {
                    movieId = await resolveMovieId(top.candidate);
                    if (movieId === null)
                        matchState = 'AMBIGUOUS';
                }
                else {
                    seriesId = await resolveSeriesId(top.candidate);
                    if (seriesId === null)
                        matchState = 'AMBIGUOUS';
                }
            }
        }
        const top1Conf = top ? top.confidence.toFixed(4) : 'n/a';
        const top2Conf = second ? second.confidence.toFixed(4) : 'n/a';
        const yearInfo = `extracted=${extractedYear ?? 'none'},provider=${input.providerYear ?? 'none'}`;
        let notes;
        if (candidates.length === 0) {
            notes = `source:${source}; no candidates; year:${yearInfo}`;
        }
        else {
            notes = `source:${source}; candidates:${candidates.length}, top-2:[${top1Conf},${top2Conf}], gap:${rawGap.toFixed(4)}, year:${yearInfo}, state:${matchState}`;
        }
        const now = new Date();
        const row = {
            providerId: input.providerId,
            providerItemId: input.providerItemId,
            mediaType: input.mediaType,
            rawTitle: input.rawTitle,
            normalizedTitle,
            extractedYear,
            matchState,
            movieId,
            seriesId,
            confidence: top !== undefined ? String(top.confidence.toFixed(4)) : null,
            candidateCount: candidates.length,
            notes,
            matchedAt: matchState === 'MATCHED' ? now : null,
            updatedAt: now,
        };
        const [result] = await db
            .insert(titleMatchResults)
            .values({ ...row, createdAt: now })
            .onConflictDoUpdate({
            target: [
                titleMatchResults.providerId,
                titleMatchResults.providerItemId,
                titleMatchResults.mediaType,
            ],
            set: row,
            where: ne(titleMatchResults.matchState, 'MATCHED'),
        })
            .returning();
        if (!result) {
            const [current] = await db
                .select()
                .from(titleMatchResults)
                .where(and(eq(titleMatchResults.providerId, input.providerId), eq(titleMatchResults.providerItemId, input.providerItemId), eq(titleMatchResults.mediaType, input.mediaType)));
            return toMatchResult(current);
        }
        return toMatchResult(result);
    }
    /**
     * Match a batch of items using a bounded-concurrency sliding window.
     * When opts is omitted, runs sequentially (preserves test isolation).
     * Per-item errors (e.g. TMDB network failures) produce a synthetic UNMATCHED
     * result instead of aborting the whole batch.
     */
    async matchBatch(inputs, opts) {
        if (inputs.length === 0)
            return [];
        const limit = opts?.concurrency ?? 1;
        const throttleMs = opts?.throttleMs ?? 0;
        const results = new Array(inputs.length);
        const queue = inputs.map((input, i) => ({ input, i }));
        this.movieIndex = null;
        this.seriesIndex = null;
        const worker = async () => {
            while (queue.length > 0) {
                const item = queue.shift();
                try {
                    results[item.i] = await this.matchItem(item.input);
                }
                catch {
                    const { normalizedTitle, extractedYear } = normalizeTitle(item.input.rawTitle);
                    results[item.i] = {
                        id: '',
                        providerId: item.input.providerId,
                        providerItemId: item.input.providerItemId,
                        matchState: 'UNMATCHED',
                        confidence: null,
                        movieId: null,
                        seriesId: null,
                        normalizedTitle,
                        extractedYear,
                        candidateCount: 0,
                        notes: 'match failed: provider error',
                    };
                }
                const usedRemote = results[item.i]?.notes.includes('source:tmdb');
                if (throttleMs > 0 && usedRemote && queue.length > 0) {
                    await new Promise((resolve) => setTimeout(resolve, throttleMs));
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker));
        return results;
    }
}
//# sourceMappingURL=title-matching-service.js.map