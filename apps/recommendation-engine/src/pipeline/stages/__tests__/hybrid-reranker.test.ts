import { describe, it, expect } from 'vitest'
import {
  computePeopleAffinity,
  computeKeywordAffinity,
  computeFranchiseAffinity,
  computeLanguageAffinity,
  computeDecadeAffinity,
  computeMediaTypeAffinity,
  getBlendedWeights,
  SCORE_MODEL_V2,
  resolveProtectionSettings,
  passesSemanticFloor,
} from '../hybrid-reranker.js'
import {
  SEMANTIC_FLOOR_MODERATE,
  SEMANTIC_FLOOR_STRICT,
  SEMANTIC_WEIGHT_THEMATIC,
} from '../../../config.js'

// Minimal EnrichedCandidate stub with only the fields each function needs.
function makeCandidate(overrides: Partial<{
  mediaType: 'movie' | 'series'
  year: number | null
  keywords: string[]
  collectionId: string | null
  originalLanguage: string | null
  productionCountries: unknown[]
  creditPersonIds: string[]
  genreIds: string[]
  genreNames: string[]
}> = {}) {
  return {
    id: 'test-id',
    mediaType: 'movie' as const,
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
  }
}

// ---------------------------------------------------------------------------
// SCORE_MODEL_V2
// ---------------------------------------------------------------------------

describe('SCORE_MODEL_V2', () => {
  it('has version v2', () => {
    expect(SCORE_MODEL_V2.version).toBe('v2')
  })

  it('all weight values are positive and less than 1', () => {
    const { version: _v, ...weights } = SCORE_MODEL_V2
    for (const w of Object.values(weights)) {
      expect(w).toBeGreaterThan(0)
      expect(w).toBeLessThan(1)
    }
  })
})

// ---------------------------------------------------------------------------
// computePeopleAffinity
// ---------------------------------------------------------------------------

describe('computePeopleAffinity', () => {
  it('returns 0.5 when candidate has no credit person IDs', () => {
    const c = makeCandidate({ creditPersonIds: [] })
    expect(computePeopleAffinity(c, { 'person-1': 5 })).toBe(0.5)
  })

  it('returns 0.5 when personScores is empty', () => {
    const c = makeCandidate({ creditPersonIds: ['person-1'] })
    expect(computePeopleAffinity(c, {})).toBe(0.5)
  })

  it('returns 0.5 when no credit IDs overlap with personScores', () => {
    const c = makeCandidate({ creditPersonIds: ['person-2'] })
    expect(computePeopleAffinity(c, { 'person-1': 5 })).toBe(0.5)
  })

  it('returns 1.0 when best score equals calibration constant (5)', () => {
    const c = makeCandidate({ creditPersonIds: ['person-1'] })
    expect(computePeopleAffinity(c, { 'person-1': 5 })).toBe(1.0)
  })

  it('returns normalized value for partial score', () => {
    const c = makeCandidate({ creditPersonIds: ['person-1'] })
    const result = computePeopleAffinity(c, { 'person-1': 2.5 })
    expect(result).toBeCloseTo(0.5, 5)
  })

  it('clips to 1.0 for scores above calibration constant', () => {
    const c = makeCandidate({ creditPersonIds: ['person-1'] })
    expect(computePeopleAffinity(c, { 'person-1': 20 })).toBe(1.0)
  })

  it('ignores negative person scores', () => {
    const c = makeCandidate({ creditPersonIds: ['person-neg', 'person-pos'] })
    const result = computePeopleAffinity(c, { 'person-neg': -3, 'person-pos': 5 })
    expect(result).toBe(1.0)
  })

  it('returns 0.5 when all matching credits have non-positive scores', () => {
    const c = makeCandidate({ creditPersonIds: ['person-neg'] })
    expect(computePeopleAffinity(c, { 'person-neg': -3 })).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// computeKeywordAffinity
// ---------------------------------------------------------------------------

describe('computeKeywordAffinity', () => {
  it('returns 0.5 when candidate has no keywords', () => {
    const c = makeCandidate({ keywords: [] })
    expect(computeKeywordAffinity(c, { 'thriller': 3 })).toBe(0.5)
  })

  it('returns 0.5 when keywordScores is empty', () => {
    const c = makeCandidate({ keywords: ['thriller'] })
    expect(computeKeywordAffinity(c, {})).toBe(0.5)
  })

  it('returns 0.5 when no keywords overlap with positive scores', () => {
    const c = makeCandidate({ keywords: ['romance'] })
    expect(computeKeywordAffinity(c, { 'thriller': 3 })).toBe(0.5)
  })

  it('returns 1.0 when all candidate keywords match', () => {
    const c = makeCandidate({ keywords: ['thriller', 'spy'] })
    expect(computeKeywordAffinity(c, { 'thriller': 3, 'spy': 2 })).toBe(1.0)
  })

  it('returns partial match ratio', () => {
    const c = makeCandidate({ keywords: ['thriller', 'spy', 'action', 'drama', 'crime'] })
    // 2 of 5 match, min(5, 5)=5, 2/5 = 0.4
    const result = computeKeywordAffinity(c, { 'thriller': 3, 'spy': 2 })
    expect(result).toBeCloseTo(0.4, 5)
  })

  it('ignores keywords with negative scores', () => {
    const c = makeCandidate({ keywords: ['horror'] })
    expect(computeKeywordAffinity(c, { 'horror': -3 })).toBe(0.5)
  })
})

// ---------------------------------------------------------------------------
// computeFranchiseAffinity
// ---------------------------------------------------------------------------

describe('computeFranchiseAffinity', () => {
  it('returns 0.5 when candidate has no collection ID', () => {
    const c = makeCandidate({ collectionId: null })
    expect(computeFranchiseAffinity(c, { 'col-1': 3 })).toBe(0.5)
  })

  it('returns 0.5 when collection is not in franchiseScores', () => {
    const c = makeCandidate({ collectionId: 'col-2' })
    expect(computeFranchiseAffinity(c, { 'col-1': 3 })).toBe(0.5)
  })

  it('returns 1.0 when collection is the top franchise', () => {
    const c = makeCandidate({ collectionId: 'col-1' })
    expect(computeFranchiseAffinity(c, { 'col-1': 3 })).toBe(1.0)
  })

  it('returns 0.2 when franchise score is negative', () => {
    const c = makeCandidate({ collectionId: 'col-bad' })
    expect(computeFranchiseAffinity(c, { 'col-bad': -2, 'col-good': 3 })).toBe(0.2)
  })

  it('returns normalized value when collection is not the top franchise', () => {
    const c = makeCandidate({ collectionId: 'col-low' })
    const result = computeFranchiseAffinity(c, { 'col-low': 1, 'col-high': 4 })
    expect(result).toBeCloseTo(0.25, 5)
  })
})

// ---------------------------------------------------------------------------
// computeLanguageAffinity
// ---------------------------------------------------------------------------

describe('computeLanguageAffinity', () => {
  it('returns 0.5 when no language or country data exists', () => {
    const c = makeCandidate({ originalLanguage: null, productionCountries: [] })
    expect(computeLanguageAffinity(c, {}, {})).toBe(0.5)
  })

  it('returns ~1.0 when language is the top preferred language', () => {
    const c = makeCandidate({ originalLanguage: 'fr', productionCountries: [] })
    const result = computeLanguageAffinity(c, { 'fr': 5 }, {})
    expect(result).toBeCloseTo(0.75, 5) // (1.0 lang + 0.5 country neutral) / 2
  })

  it('returns ~0.35 when language score is negative', () => {
    const c = makeCandidate({ originalLanguage: 'de', productionCountries: [] })
    const result = computeLanguageAffinity(c, { 'de': -3, 'fr': 5 }, {})
    expect(result).toBeCloseTo(0.35, 5) // (0.2 neg + 0.5 neutral) / 2
  })

  it('factors in production country scores', () => {
    const c = makeCandidate({
      originalLanguage: null,
      productionCountries: ['FR'],
    })
    const result = computeLanguageAffinity(c, {}, { 'FR': 4 })
    expect(result).toBeCloseTo(0.75, 5) // (0.5 lang neutral + 1.0 country) / 2
  })

  it('handles country as object with iso3166_1', () => {
    const c = makeCandidate({
      originalLanguage: null,
      productionCountries: [{ iso3166_1: 'JP' }],
    })
    const result = computeLanguageAffinity(c, {}, { 'JP': 3 })
    expect(result).toBeCloseTo(0.75, 5)
  })
})

// ---------------------------------------------------------------------------
// computeDecadeAffinity
// ---------------------------------------------------------------------------

describe('computeDecadeAffinity', () => {
  it('returns 0.5 when candidate year is null', () => {
    const c = makeCandidate({ year: null })
    expect(computeDecadeAffinity(c, { '1980s': 5 })).toBe(0.5)
  })

  it('returns 0.5 when decade not in decadeScores', () => {
    const c = makeCandidate({ year: 2015 })
    expect(computeDecadeAffinity(c, { '1980s': 5 })).toBe(0.5)
  })

  it('returns 1.0 when decade is the top preferred decade', () => {
    const c = makeCandidate({ year: 1985 })
    expect(computeDecadeAffinity(c, { '1980s': 5 })).toBe(1.0)
  })

  it('returns 0.3 when decade score is negative', () => {
    const c = makeCandidate({ year: 2005 })
    expect(computeDecadeAffinity(c, { '2000s': -2, '1980s': 5 })).toBe(0.3)
  })

  it('maps year to correct decade', () => {
    const c = makeCandidate({ year: 2010 })
    const result = computeDecadeAffinity(c, { '2010s': 3 })
    expect(result).toBe(1.0)
  })

  it('returns normalized value for partial decade preference', () => {
    const c = makeCandidate({ year: 1995 })
    const result = computeDecadeAffinity(c, { '1990s': 2, '1980s': 4 })
    expect(result).toBeCloseTo(0.5, 5)
  })
})

// ---------------------------------------------------------------------------
// computeMediaTypeAffinity
// ---------------------------------------------------------------------------

describe('computeMediaTypeAffinity', () => {
  it('returns 0.5 when no media type preferences exist', () => {
    const c = makeCandidate({ mediaType: 'movie' })
    expect(computeMediaTypeAffinity(c, {})).toBe(0.5)
  })

  it('returns 1.0 when candidate type matches dominant preference', () => {
    const c = makeCandidate({ mediaType: 'movie' })
    expect(computeMediaTypeAffinity(c, { 'movie': 10, 'series': 3 })).toBe(1.0)
  })

  it('returns 0.3 when candidate type is the non-dominant type', () => {
    const c = makeCandidate({ mediaType: 'series' })
    expect(computeMediaTypeAffinity(c, { 'movie': 10, 'series': 3 })).toBe(0.3)
  })

  it('returns 1.0 (movie wins tie) when scores are equal', () => {
    const c = makeCandidate({ mediaType: 'movie' })
    expect(computeMediaTypeAffinity(c, { 'movie': 5, 'series': 5 })).toBe(1.0)
  })

  it('handles series-dominant profile', () => {
    const c = makeCandidate({ mediaType: 'series' })
    expect(computeMediaTypeAffinity(c, { 'movie': 2, 'series': 8 })).toBe(1.0)
  })
})

// ---------------------------------------------------------------------------
// Semantic floor protection (T121)
// ---------------------------------------------------------------------------

describe('semantic floor protection', () => {
  it('resolveProtectionSettings returns thematic blend and SEMANTIC_FLOOR_STRICT for strict', () => {
    const { blendLevel, semanticFloor } = resolveProtectionSettings('strict')
    expect(blendLevel).toBe('thematic')
    expect(semanticFloor).toBe(SEMANTIC_FLOOR_STRICT)
  })

  it('resolveProtectionSettings returns thematic blend and SEMANTIC_FLOOR_MODERATE for moderate', () => {
    const { blendLevel, semanticFloor } = resolveProtectionSettings('moderate')
    expect(blendLevel).toBe('thematic')
    expect(semanticFloor).toBe(SEMANTIC_FLOOR_MODERATE)
  })

  it('resolveProtectionSettings returns exploit blend and zero floor for none/undefined', () => {
    expect(resolveProtectionSettings('none')).toEqual({ blendLevel: 'exploit', semanticFloor: 0 })
    expect(resolveProtectionSettings(undefined)).toEqual({ blendLevel: 'exploit', semanticFloor: 0 })
  })

  it('passesSemanticFloor excludes candidates strictly below the floor', () => {
    expect(passesSemanticFloor(0.20, SEMANTIC_FLOOR_MODERATE)).toBe(false)
    expect(passesSemanticFloor(0.27, SEMANTIC_FLOOR_MODERATE)).toBe(false)
    expect(passesSemanticFloor(null, SEMANTIC_FLOOR_MODERATE)).toBe(false)
  })

  it('passesSemanticFloor admits candidates at or above the floor', () => {
    expect(passesSemanticFloor(SEMANTIC_FLOOR_MODERATE, SEMANTIC_FLOOR_MODERATE)).toBe(true)
    expect(passesSemanticFloor(0.35, SEMANTIC_FLOOR_MODERATE)).toBe(true)
    expect(passesSemanticFloor(0.90, SEMANTIC_FLOOR_STRICT)).toBe(true)
  })

  it('passesSemanticFloor always admits when floor is 0', () => {
    expect(passesSemanticFloor(0, 0)).toBe(true)
    expect(passesSemanticFloor(null, 0)).toBe(true)
    expect(passesSemanticFloor(0.01, 0)).toBe(true)
  })

  it('SEMANTIC_FLOOR_STRICT is higher than SEMANTIC_FLOOR_MODERATE', () => {
    expect(SEMANTIC_FLOOR_STRICT).toBeGreaterThan(SEMANTIC_FLOOR_MODERATE)
  })

  it('thematic blend sets wSemantic to SEMANTIC_WEIGHT_THEMATIC', () => {
    const weights = getBlendedWeights(SCORE_MODEL_V2, 'thematic')
    expect(weights.wSemantic).toBe(SEMANTIC_WEIGHT_THEMATIC)
  })
})

// ---------------------------------------------------------------------------
// Profile cannot override semantic (T121)
// ---------------------------------------------------------------------------

describe('profile cannot override semantic intent', () => {
  it('floor excludes low-semantic candidate even with maximum profile affinity', () => {
    const { blendLevel, semanticFloor: floor } = resolveProtectionSettings('moderate')
    const weights = getBlendedWeights(SCORE_MODEL_V2, blendLevel)

    const profileWeightSum =
      weights.wGenre + weights.wTheme + weights.wPeople + weights.wKeyword +
      weights.wFranchise + weights.wLanguage + weights.wDecade + weights.wMediaType

    // Candidate B: weak semantic (below floor) + maximum profile affinity
    const semanticB = 0.26
    const hypotheticalScoreB = semanticB * weights.wSemantic + 1.0 * profileWeightSum

    // Candidate A: good semantic relevance + neutral profile affinity
    const semanticA = 0.70
    const scoreA = semanticA * weights.wSemantic + 0.5 * profileWeightSum

    // Without the floor, B would outrank A on raw score (profile dominates)
    expect(hypotheticalScoreB).toBeGreaterThan(scoreA)

    // With the floor, passesSemanticFloor(B) is false — profile cannot rescue it
    expect(passesSemanticFloor(semanticB, floor)).toBe(false)
    expect(passesSemanticFloor(semanticA, floor)).toBe(true)
  })
})
