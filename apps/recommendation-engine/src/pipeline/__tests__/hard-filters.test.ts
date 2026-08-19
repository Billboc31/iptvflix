import { describe, it, expect } from 'vitest'
import { passesHardFilters, HARD_FILTER_UNKNOWN_POLICY } from '../stages/hybrid-reranker.js'
import type { EnrichedCandidate } from '../stages/hybrid-reranker.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'

function makeCandidate(overrides: Partial<EnrichedCandidate> = {}): EnrichedCandidate {
  return {
    id: 'test-1',
    mediaType: 'movie',
    title: 'Test Movie',
    year: 2020,
    posterPath: null,
    score: 1,
    similarity: 1,
    reasons: [],
    scoreBreakdown: {},
    available: true,
    genreIds: [],
    genreNames: [],
    collectionId: null,
    directors: [],
    keywords: [],
    durationMinutes: 120,
    originalLanguage: 'en',
    popularity: null,
    voteAverage: null,
    completionRatio: null,
    exposureCount: 0,
    ...overrides,
  }
}

function makePlan(hardFilters: RecommendationQueryPlan['hardFilters'] = {}): RecommendationQueryPlan {
  return {
    schemaVersion: '1',
    rawQuery: 'test',
    displayTitle: 'test',
    semanticIntent: 'test',
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: ['MOVIE', 'SERIES'],
    hardFilters,
    softPreferences: {},
    userConstraints: [],
    plannerFallback: false,
    plannerMeta: null,
  }
}

describe('HARD_FILTER_UNKNOWN_POLICY', () => {
  it('is STRICT_EXCLUDE_UNKNOWN', () => {
    expect(HARD_FILTER_UNKNOWN_POLICY).toBe('STRICT_EXCLUDE_UNKNOWN')
  })
})

describe('passesHardFilters — maxRuntimeMinutes (STRICT_EXCLUDE_UNKNOWN)', () => {
  it('excludes candidate with null durationMinutes when maxRuntimeMinutes is set', () => {
    const c = makeCandidate({ durationMinutes: null })
    expect(passesHardFilters(c, makePlan({ maxRuntimeMinutes: 90 }))).toBe(false)
  })

  it('excludes candidate whose duration exceeds the limit', () => {
    const c = makeCandidate({ durationMinutes: 120 })
    expect(passesHardFilters(c, makePlan({ maxRuntimeMinutes: 90 }))).toBe(false)
  })

  it('passes candidate whose duration is within the limit', () => {
    const c = makeCandidate({ durationMinutes: 80 })
    expect(passesHardFilters(c, makePlan({ maxRuntimeMinutes: 90 }))).toBe(true)
  })

  it('passes candidate with null durationMinutes when no maxRuntimeMinutes filter', () => {
    const c = makeCandidate({ durationMinutes: null })
    expect(passesHardFilters(c, makePlan({}))).toBe(true)
  })
})

describe('passesHardFilters — minReleaseYear / maxReleaseYear (STRICT_EXCLUDE_UNKNOWN)', () => {
  it('excludes candidate with null year when minReleaseYear is set', () => {
    const c = makeCandidate({ year: null })
    expect(passesHardFilters(c, makePlan({ minReleaseYear: 2010 }))).toBe(false)
  })

  it('excludes candidate with null year when maxReleaseYear is set', () => {
    const c = makeCandidate({ year: null })
    expect(passesHardFilters(c, makePlan({ maxReleaseYear: 2022 }))).toBe(false)
  })

  it('excludes candidate with null year when both year filters are set', () => {
    const c = makeCandidate({ year: null })
    expect(passesHardFilters(c, makePlan({ minReleaseYear: 2010, maxReleaseYear: 2022 }))).toBe(false)
  })

  it('excludes candidate whose year is before minReleaseYear', () => {
    const c = makeCandidate({ year: 2005 })
    expect(passesHardFilters(c, makePlan({ minReleaseYear: 2010 }))).toBe(false)
  })

  it('excludes candidate whose year is after maxReleaseYear', () => {
    const c = makeCandidate({ year: 2025 })
    expect(passesHardFilters(c, makePlan({ maxReleaseYear: 2022 }))).toBe(false)
  })

  it('passes candidate within release year range', () => {
    const c = makeCandidate({ year: 2015 })
    expect(passesHardFilters(c, makePlan({ minReleaseYear: 2010, maxReleaseYear: 2022 }))).toBe(true)
  })

  it('passes candidate with null year when no year filters are set', () => {
    const c = makeCandidate({ year: null })
    expect(passesHardFilters(c, makePlan({}))).toBe(true)
  })
})

describe('passesHardFilters — audioLanguages (STRICT_EXCLUDE_UNKNOWN)', () => {
  it('excludes candidate with null originalLanguage when audioLanguages filter is set', () => {
    const c = makeCandidate({ originalLanguage: null })
    expect(passesHardFilters(c, makePlan({ audioLanguages: ['fr', 'en'] }))).toBe(false)
  })

  it('excludes candidate whose language is not in the allowed list', () => {
    const c = makeCandidate({ originalLanguage: 'de' })
    expect(passesHardFilters(c, makePlan({ audioLanguages: ['fr', 'en'] }))).toBe(false)
  })

  it('passes candidate whose language is in the allowed list', () => {
    const c = makeCandidate({ originalLanguage: 'fr' })
    expect(passesHardFilters(c, makePlan({ audioLanguages: ['fr', 'en'] }))).toBe(true)
  })

  it('passes candidate with null originalLanguage when no audioLanguages filter', () => {
    const c = makeCandidate({ originalLanguage: null })
    expect(passesHardFilters(c, makePlan({}))).toBe(true)
  })
})

describe('passesHardFilters — mediaTypes', () => {
  it('excludes candidate whose mediaType is not in the allowed list', () => {
    const c = makeCandidate({ mediaType: 'movie' })
    const plan = makePlan()
    plan.mediaTypes = ['SERIES']
    expect(passesHardFilters(c, plan)).toBe(false)
  })

  it('passes when mediaTypes allows both types', () => {
    const c = makeCandidate({ mediaType: 'movie' })
    expect(passesHardFilters(c, makePlan())).toBe(true)
  })
})
