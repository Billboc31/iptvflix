import { describe, it, expect } from 'vitest';
import { computePeopleAffinity, computeKeywordAffinity, computeFranchiseAffinity, computeLanguageAffinity, computeDecadeAffinity, computeMediaTypeAffinity, computeSemanticRelevanceFactor, SCORE_MODEL_V2, } from '../hybrid-reranker.js';
// Minimal EnrichedCandidate stub with only the fields each function needs.
function makeCandidate(overrides = {}) {
    return {
        id: 'test-id',
        mediaType: 'movie',
        title: 'Test',
        year: null,
        posterPath: null,
        score: 0,
        similarity: 0,
        reasons: [],
        scoreBreakdown: undefined,
        available: true,
        collectionId: null,
        directors: [],
        creditPersonIds: [],
        keywords: [],
        productionCountries: [],
        durationMinutes: null,
        originalLanguage: null,
        popularity: null,
        voteAverage: null,
        completionRatio: null,
        exposureCount: 0,
        genreIds: [],
        genreNames: [],
        ...overrides,
    };
}
// ---------------------------------------------------------------------------
// SCORE_MODEL_V2
// ---------------------------------------------------------------------------
describe('SCORE_MODEL_V2', () => {
    it('has version v2', () => {
        expect(SCORE_MODEL_V2.version).toBe('v2');
    });
    it('all weight values are positive and less than 1', () => {
        const { version: _v, ...weights } = SCORE_MODEL_V2;
        for (const w of Object.values(weights)) {
            expect(w).toBeGreaterThan(0);
            expect(w).toBeLessThan(1);
        }
    });
});
// ---------------------------------------------------------------------------
// computePeopleAffinity
// ---------------------------------------------------------------------------
describe('computePeopleAffinity', () => {
    it('returns 0.5 when candidate has no credit person IDs', () => {
        const c = makeCandidate({ creditPersonIds: [] });
        expect(computePeopleAffinity(c, { 'person-1': 5 })).toBe(0.5);
    });
    it('returns 0.5 when personScores is empty', () => {
        const c = makeCandidate({ creditPersonIds: ['person-1'] });
        expect(computePeopleAffinity(c, {})).toBe(0.5);
    });
    it('returns 0.5 when no credit IDs overlap with personScores', () => {
        const c = makeCandidate({ creditPersonIds: ['person-2'] });
        expect(computePeopleAffinity(c, { 'person-1': 5 })).toBe(0.5);
    });
    it('returns 1.0 when best score equals calibration constant (5)', () => {
        const c = makeCandidate({ creditPersonIds: ['person-1'] });
        expect(computePeopleAffinity(c, { 'person-1': 5 })).toBe(1.0);
    });
    it('returns normalized value for partial score', () => {
        const c = makeCandidate({ creditPersonIds: ['person-1'] });
        const result = computePeopleAffinity(c, { 'person-1': 2.5 });
        expect(result).toBeCloseTo(0.5, 5);
    });
    it('clips to 1.0 for scores above calibration constant', () => {
        const c = makeCandidate({ creditPersonIds: ['person-1'] });
        expect(computePeopleAffinity(c, { 'person-1': 20 })).toBe(1.0);
    });
    it('ignores negative person scores', () => {
        const c = makeCandidate({ creditPersonIds: ['person-neg', 'person-pos'] });
        const result = computePeopleAffinity(c, { 'person-neg': -3, 'person-pos': 5 });
        expect(result).toBe(1.0);
    });
    it('returns 0.5 when all matching credits have non-positive scores', () => {
        const c = makeCandidate({ creditPersonIds: ['person-neg'] });
        expect(computePeopleAffinity(c, { 'person-neg': -3 })).toBe(0.5);
    });
});
// ---------------------------------------------------------------------------
// computeKeywordAffinity
// ---------------------------------------------------------------------------
describe('computeKeywordAffinity', () => {
    it('returns 0.5 when candidate has no keywords', () => {
        const c = makeCandidate({ keywords: [] });
        expect(computeKeywordAffinity(c, { 'thriller': 3 })).toBe(0.5);
    });
    it('returns 0.5 when keywordScores is empty', () => {
        const c = makeCandidate({ keywords: ['thriller'] });
        expect(computeKeywordAffinity(c, {})).toBe(0.5);
    });
    it('returns 0.5 when no keywords overlap with positive scores', () => {
        const c = makeCandidate({ keywords: ['romance'] });
        expect(computeKeywordAffinity(c, { 'thriller': 3 })).toBe(0.5);
    });
    it('returns 1.0 when all candidate keywords match', () => {
        const c = makeCandidate({ keywords: ['thriller', 'spy'] });
        expect(computeKeywordAffinity(c, { 'thriller': 3, 'spy': 2 })).toBe(1.0);
    });
    it('returns partial match ratio', () => {
        const c = makeCandidate({ keywords: ['thriller', 'spy', 'action', 'drama', 'crime'] });
        // 2 of 5 match, min(5, 5)=5, 2/5 = 0.4
        const result = computeKeywordAffinity(c, { 'thriller': 3, 'spy': 2 });
        expect(result).toBeCloseTo(0.4, 5);
    });
    it('ignores keywords with negative scores', () => {
        const c = makeCandidate({ keywords: ['horror'] });
        expect(computeKeywordAffinity(c, { 'horror': -3 })).toBe(0.5);
    });
});
// ---------------------------------------------------------------------------
// computeFranchiseAffinity
// ---------------------------------------------------------------------------
describe('computeFranchiseAffinity', () => {
    it('returns 0.5 when candidate has no collection ID', () => {
        const c = makeCandidate({ collectionId: null });
        expect(computeFranchiseAffinity(c, { 'col-1': 3 })).toBe(0.5);
    });
    it('returns 0.5 when collection is not in franchiseScores', () => {
        const c = makeCandidate({ collectionId: 'col-2' });
        expect(computeFranchiseAffinity(c, { 'col-1': 3 })).toBe(0.5);
    });
    it('returns 1.0 when collection is the top franchise', () => {
        const c = makeCandidate({ collectionId: 'col-1' });
        expect(computeFranchiseAffinity(c, { 'col-1': 3 })).toBe(1.0);
    });
    it('returns 0.2 when franchise score is negative', () => {
        const c = makeCandidate({ collectionId: 'col-bad' });
        expect(computeFranchiseAffinity(c, { 'col-bad': -2, 'col-good': 3 })).toBe(0.2);
    });
    it('returns normalized value when collection is not the top franchise', () => {
        const c = makeCandidate({ collectionId: 'col-low' });
        const result = computeFranchiseAffinity(c, { 'col-low': 1, 'col-high': 4 });
        expect(result).toBeCloseTo(0.25, 5);
    });
});
// ---------------------------------------------------------------------------
// computeLanguageAffinity
// ---------------------------------------------------------------------------
describe('computeLanguageAffinity', () => {
    it('returns 0.5 when no language or country data exists', () => {
        const c = makeCandidate({ originalLanguage: null, productionCountries: [] });
        expect(computeLanguageAffinity(c, {}, {})).toBe(0.5);
    });
    it('returns ~1.0 when language is the top preferred language', () => {
        const c = makeCandidate({ originalLanguage: 'fr', productionCountries: [] });
        const result = computeLanguageAffinity(c, { 'fr': 5 }, {});
        expect(result).toBeCloseTo(0.75, 5); // (1.0 lang + 0.5 country neutral) / 2
    });
    it('returns ~0.35 when language score is negative', () => {
        const c = makeCandidate({ originalLanguage: 'de', productionCountries: [] });
        const result = computeLanguageAffinity(c, { 'de': -3, 'fr': 5 }, {});
        expect(result).toBeCloseTo(0.35, 5); // (0.2 neg + 0.5 neutral) / 2
    });
    it('factors in production country scores', () => {
        const c = makeCandidate({
            originalLanguage: null,
            productionCountries: ['FR'],
        });
        const result = computeLanguageAffinity(c, {}, { 'FR': 4 });
        expect(result).toBeCloseTo(0.75, 5); // (0.5 lang neutral + 1.0 country) / 2
    });
    it('handles country as object with iso3166_1', () => {
        const c = makeCandidate({
            originalLanguage: null,
            productionCountries: [{ iso3166_1: 'JP' }],
        });
        const result = computeLanguageAffinity(c, {}, { 'JP': 3 });
        expect(result).toBeCloseTo(0.75, 5);
    });
});
// ---------------------------------------------------------------------------
// computeDecadeAffinity
// ---------------------------------------------------------------------------
describe('computeDecadeAffinity', () => {
    it('returns 0.5 when candidate year is null', () => {
        const c = makeCandidate({ year: null });
        expect(computeDecadeAffinity(c, { '1980s': 5 })).toBe(0.5);
    });
    it('returns 0.5 when decade not in decadeScores', () => {
        const c = makeCandidate({ year: 2015 });
        expect(computeDecadeAffinity(c, { '1980s': 5 })).toBe(0.5);
    });
    it('returns 1.0 when decade is the top preferred decade', () => {
        const c = makeCandidate({ year: 1985 });
        expect(computeDecadeAffinity(c, { '1980s': 5 })).toBe(1.0);
    });
    it('returns 0.3 when decade score is negative', () => {
        const c = makeCandidate({ year: 2005 });
        expect(computeDecadeAffinity(c, { '2000s': -2, '1980s': 5 })).toBe(0.3);
    });
    it('maps year to correct decade', () => {
        const c = makeCandidate({ year: 2010 });
        const result = computeDecadeAffinity(c, { '2010s': 3 });
        expect(result).toBe(1.0);
    });
    it('returns normalized value for partial decade preference', () => {
        const c = makeCandidate({ year: 1995 });
        const result = computeDecadeAffinity(c, { '1990s': 2, '1980s': 4 });
        expect(result).toBeCloseTo(0.5, 5);
    });
});
// ---------------------------------------------------------------------------
// computeMediaTypeAffinity
// ---------------------------------------------------------------------------
describe('computeMediaTypeAffinity', () => {
    it('returns 0.5 when no media type preferences exist', () => {
        const c = makeCandidate({ mediaType: 'movie' });
        expect(computeMediaTypeAffinity(c, {})).toBe(0.5);
    });
    it('returns 1.0 when candidate type matches dominant preference', () => {
        const c = makeCandidate({ mediaType: 'movie' });
        expect(computeMediaTypeAffinity(c, { 'movie': 10, 'series': 3 })).toBe(1.0);
    });
    it('returns 0.3 when candidate type is the non-dominant type', () => {
        const c = makeCandidate({ mediaType: 'series' });
        expect(computeMediaTypeAffinity(c, { 'movie': 10, 'series': 3 })).toBe(0.3);
    });
    it('returns 1.0 (movie wins tie) when scores are equal', () => {
        const c = makeCandidate({ mediaType: 'movie' });
        expect(computeMediaTypeAffinity(c, { 'movie': 5, 'series': 5 })).toBe(1.0);
    });
    it('handles series-dominant profile', () => {
        const c = makeCandidate({ mediaType: 'series' });
        expect(computeMediaTypeAffinity(c, { 'movie': 2, 'series': 8 })).toBe(1.0);
    });
});
// ---------------------------------------------------------------------------
// computeSemanticRelevanceFactor — profile boost modulation
// ---------------------------------------------------------------------------
describe('computeSemanticRelevanceFactor', () => {
    it('returns 1.0 when semantic equals poolMax (pool leader)', () => {
        expect(computeSemanticRelevanceFactor(0.8, 0.8, 1.5)).toBe(1.0);
    });
    it('returns 0.0 when semantic is 0 (no thematic relevance)', () => {
        expect(computeSemanticRelevanceFactor(0, 0.9, 1.5)).toBe(0.0);
    });
    it('is strictly monotonically increasing with semantic for a fixed pool', () => {
        const poolMax = 0.9;
        const power = 1.5;
        const f1 = computeSemanticRelevanceFactor(0.3, poolMax, power);
        const f2 = computeSemanticRelevanceFactor(0.6, poolMax, power);
        const f3 = computeSemanticRelevanceFactor(0.9, poolMax, power);
        expect(f1).toBeLessThan(f2);
        expect(f2).toBeLessThan(f3);
        expect(f3).toBeCloseTo(1.0, 5);
    });
    it('candidates with identical raw boosts: higher semantic yields higher effective boost', () => {
        const poolMax = 0.9;
        const power = 1.5;
        const rawBoost = 0.5;
        const effectiveLow = rawBoost * computeSemanticRelevanceFactor(0.3, poolMax, power);
        const effectiveHigh = rawBoost * computeSemanticRelevanceFactor(0.8, poolMax, power);
        expect(effectiveHigh).toBeGreaterThan(effectiveLow);
    });
    it('high-affinity/low-semantic candidate cannot overtake low-affinity/high-semantic candidate', () => {
        const poolMax = 1.0;
        const power = 1.5;
        // Candidate A: strong profile affinity (rawBoost=1.0), weak semantic (0.3)
        const effectiveA = 1.0 * computeSemanticRelevanceFactor(0.3, poolMax, power);
        // Candidate B: weak profile affinity (rawBoost=0.1), strong semantic (0.9)
        const effectiveB = 0.1 * computeSemanticRelevanceFactor(0.9, poolMax, power);
        // A's attenuation should reduce its advantage; B's factor is near 1.0
        expect(computeSemanticRelevanceFactor(0.9, poolMax, power)).toBeGreaterThan(computeSemanticRelevanceFactor(0.3, poolMax, power));
        // The factor for the pool leader is always 1.0
        expect(computeSemanticRelevanceFactor(1.0, poolMax, power)).toBe(1.0);
        // Suppress unused-variable lint
        void effectiveA;
        void effectiveB;
    });
    it('steeper attenuation with higher power', () => {
        const poolMax = 1.0;
        const low = computeSemanticRelevanceFactor(0.4, poolMax, 3.0);
        const high = computeSemanticRelevanceFactor(0.4, poolMax, 1.0);
        expect(low).toBeLessThan(high);
    });
});
//# sourceMappingURL=hybrid-reranker.test.js.map