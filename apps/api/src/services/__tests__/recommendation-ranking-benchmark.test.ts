/**
 * Deterministic benchmark: fixed candidate pool, fixed similarity scores, fixed taste.
 * Compares vector-only vs hybrid vs hybrid-with-diversity outputs.
 */

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../db/client.js', () => ({ db: {} }))

import { rankHybrid, SCORE_MODEL_V1 } from '../recommendation-ranking-service.js'
import type { HybridCandidate, TasteSignals } from '../recommendation-ranking-service.js'

// ─── fixture data ────────────────────────────────────────────────────────────

const GENRE_SCI_FI = 'genre-scifi-0000-0000-000000000001'
const GENRE_ACTION = 'genre-action-0000-0000-000000000001'
const GENRE_ROMANCE = 'genre-romance-000-0000-000000000001'
const GENRE_COMEDY = 'genre-comedy-0000-0000-000000000001'
const GENRE_HORROR = 'genre-horror-0000-0000-000000000001'

const COLLECTION_FRANCHISE = 'coll-franchise-00-0000-000000000001'

// 20 candidates with fixed properties
const CANDIDATES: HybridCandidate[] = [
  // Sci-fi / action cluster (semantically relevant, high similarity)
  {
    mediaId: 'sf-1', mediaType: 'MOVIE', title: 'Sci-Fi Epic 1', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.92, genreIds: [GENRE_SCI_FI, GENRE_ACTION],
    genreNames: ['Sci-Fi', 'Action'], popularity: 80, voteAverage: 8.2, available: true,
    status: null, collectionId: COLLECTION_FRANCHISE, directors: ['Denis Villeneuve'],
    keywords: ['space', 'ai'], durationMinutes: 140, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'sf-2', mediaType: 'MOVIE', title: 'Sci-Fi Epic 2', year: 2021, posterPath: null,
    source: 'LOCAL', similarity: 0.90, genreIds: [GENRE_SCI_FI, GENRE_ACTION],
    genreNames: ['Sci-Fi', 'Action'], popularity: 75, voteAverage: 7.9, available: true,
    status: null, collectionId: COLLECTION_FRANCHISE, directors: ['Denis Villeneuve'],
    keywords: ['space', 'dystopia'], durationMinutes: 130, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'sf-3', mediaType: 'MOVIE', title: 'Sci-Fi Adventure', year: 2020, posterPath: null,
    source: 'LOCAL', similarity: 0.88, genreIds: [GENRE_SCI_FI],
    genreNames: ['Sci-Fi'], popularity: 60, voteAverage: 7.5, available: true,
    status: null, collectionId: COLLECTION_FRANCHISE, directors: ['Christopher Nolan'],
    keywords: ['time travel'], durationMinutes: 120, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'sf-4', mediaType: 'MOVIE', title: 'Space Thriller', year: 2023, posterPath: null,
    source: 'LOCAL', similarity: 0.85, genreIds: [GENRE_SCI_FI, GENRE_ACTION],
    genreNames: ['Sci-Fi', 'Action'], popularity: 70, voteAverage: 8.0, available: false,
    status: null, collectionId: COLLECTION_FRANCHISE, directors: ['Denis Villeneuve'],
    keywords: ['space', 'survival'], durationMinutes: 115, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'sf-5', mediaType: 'MOVIE', title: 'AI Uprising', year: 2019, posterPath: null,
    source: 'LOCAL', similarity: 0.83, genreIds: [GENRE_SCI_FI],
    genreNames: ['Sci-Fi'], popularity: 55, voteAverage: 7.3, available: true,
    status: null, collectionId: COLLECTION_FRANCHISE, directors: ['Ridley Scott'],
    keywords: ['ai', 'robots'], durationMinutes: 110, originalLanguage: 'en', completionRatio: null,
  },
  // Action cluster
  {
    mediaId: 'act-1', mediaType: 'MOVIE', title: 'Action Hero', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.78, genreIds: [GENRE_ACTION],
    genreNames: ['Action'], popularity: 90, voteAverage: 7.8, available: true,
    status: null, collectionId: null, directors: ['Michael Bay'],
    keywords: ['explosions', 'heist'], durationMinutes: 105, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'act-2', mediaType: 'MOVIE', title: 'Speed Chase', year: 2021, posterPath: null,
    source: 'LOCAL', similarity: 0.75, genreIds: [GENRE_ACTION],
    genreNames: ['Action'], popularity: 85, voteAverage: 7.5, available: true,
    status: null, collectionId: null, directors: ['Michael Bay'],
    keywords: ['cars', 'chase'], durationMinutes: 95, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'act-3', mediaType: 'MOVIE', title: 'Combat Zone', year: 2020, posterPath: null,
    source: 'LOCAL', similarity: 0.73, genreIds: [GENRE_ACTION],
    genreNames: ['Action'], popularity: 65, voteAverage: 7.1, available: true,
    status: null, collectionId: null, directors: ['Christopher Nolan'],
    keywords: ['war', 'military'], durationMinutes: 150, originalLanguage: 'en', completionRatio: null,
  },
  // Romance / comedy cluster (low similarity, for Profile B preference)
  {
    mediaId: 'rom-1', mediaType: 'MOVIE', title: 'Love Story', year: 2023, posterPath: null,
    source: 'LOCAL', similarity: 0.45, genreIds: [GENRE_ROMANCE],
    genreNames: ['Romance'], popularity: 60, voteAverage: 7.8, available: true,
    status: null, collectionId: null, directors: ['Nora Ephron'],
    keywords: ['love', 'relationships'], durationMinutes: 100, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'rom-2', mediaType: 'MOVIE', title: 'Summer Romance', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.43, genreIds: [GENRE_ROMANCE, GENRE_COMEDY],
    genreNames: ['Romance', 'Comedy'], popularity: 55, voteAverage: 7.5, available: true,
    status: null, collectionId: null, directors: ['Nora Ephron'],
    keywords: ['love', 'summer'], durationMinutes: 95, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'com-1', mediaType: 'MOVIE', title: 'Funny Business', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.42, genreIds: [GENRE_COMEDY],
    genreNames: ['Comedy'], popularity: 70, voteAverage: 7.2, available: true,
    status: null, collectionId: null, directors: ['Judd Apatow'],
    keywords: ['humor', 'family'], durationMinutes: 90, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'com-2', mediaType: 'MOVIE', title: 'Comedy Night', year: 2021, posterPath: null,
    source: 'LOCAL', similarity: 0.40, genreIds: [GENRE_COMEDY],
    genreNames: ['Comedy'], popularity: 65, voteAverage: 7.0, available: true,
    status: null, collectionId: null, directors: ['Judd Apatow'],
    keywords: ['humor'], durationMinutes: 85, originalLanguage: 'en', completionRatio: null,
  },
  // Horror cluster
  {
    mediaId: 'hor-1', mediaType: 'MOVIE', title: 'Dark Shadows', year: 2021, posterPath: null,
    source: 'LOCAL', similarity: 0.55, genreIds: [GENRE_HORROR],
    genreNames: ['Horror'], popularity: 50, voteAverage: 7.1, available: true,
    status: null, collectionId: null, directors: ['James Wan'],
    keywords: ['ghosts', 'terror'], durationMinutes: 100, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'hor-2', mediaType: 'MOVIE', title: 'Night Terror', year: 2020, posterPath: null,
    source: 'LOCAL', similarity: 0.52, genreIds: [GENRE_HORROR],
    genreNames: ['Horror'], popularity: 45, voteAverage: 6.8, available: true,
    status: null, collectionId: null, directors: ['James Wan'],
    keywords: ['creatures'], durationMinutes: 95, originalLanguage: 'en', completionRatio: null,
  },
  // Long runtime (will be filtered by maxRuntimeMinutes: 120)
  {
    mediaId: 'long-1', mediaType: 'MOVIE', title: 'Epic Journey', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.80, genreIds: [GENRE_SCI_FI, GENRE_ACTION],
    genreNames: ['Sci-Fi', 'Action'], popularity: 95, voteAverage: 9.0, available: true,
    status: null, collectionId: null, directors: ['Peter Jackson'],
    keywords: ['epic', 'quest'], durationMinutes: 210, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'long-2', mediaType: 'MOVIE', title: 'Grand Opus', year: 2021, posterPath: null,
    source: 'LOCAL', similarity: 0.77, genreIds: [GENRE_ROMANCE],
    genreNames: ['Romance'], popularity: 70, voteAverage: 8.5, available: true,
    status: null, collectionId: null, directors: ['James Cameron'],
    keywords: ['epic'], durationMinutes: 195, originalLanguage: 'en', completionRatio: null,
  },
  // Misc
  {
    mediaId: 'misc-1', mediaType: 'MOVIE', title: 'Indie Film', year: 2023, posterPath: null,
    source: 'LOCAL', similarity: 0.60, genreIds: [GENRE_COMEDY, GENRE_ROMANCE],
    genreNames: ['Comedy', 'Romance'], popularity: 20, voteAverage: 8.1, available: true,
    status: null, collectionId: null, directors: ['Wes Anderson'],
    keywords: ['quirky', 'indie'], durationMinutes: 100, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'misc-2', mediaType: 'MOVIE', title: 'Foreign Drama', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.58, genreIds: [],
    genreNames: [], popularity: 30, voteAverage: 8.8, available: true,
    status: null, collectionId: null, directors: ['Pedro Almodóvar'],
    keywords: ['drama', 'foreign'], durationMinutes: 110, originalLanguage: 'es', completionRatio: null,
  },
  {
    mediaId: 'misc-3', mediaType: 'MOVIE', title: 'Documentary', year: 2023, posterPath: null,
    source: 'LOCAL', similarity: 0.50, genreIds: [],
    genreNames: [], popularity: 25, voteAverage: 9.2, available: true,
    status: null, collectionId: null, directors: [],
    keywords: ['documentary', 'nature'], durationMinutes: 90, originalLanguage: 'en', completionRatio: null,
  },
  {
    mediaId: 'misc-4', mediaType: 'MOVIE', title: 'Animated Feature', year: 2022, posterPath: null,
    source: 'LOCAL', similarity: 0.48, genreIds: [GENRE_COMEDY],
    genreNames: ['Comedy'], popularity: 80, voteAverage: 8.0, available: true,
    status: null, collectionId: null, directors: [],
    keywords: ['animation', 'family'], durationMinutes: 95, originalLanguage: 'en', completionRatio: null,
  },
]

// Profile A: loves Sci-Fi + Action
const TASTE_A: TasteSignals = {
  genreScores: { [GENRE_SCI_FI]: 5, [GENRE_ACTION]: 4, [GENRE_ROMANCE]: 0, [GENRE_COMEDY]: 0 },
  genreNames: { [GENRE_SCI_FI]: 'Sci-Fi', [GENRE_ACTION]: 'Action' },
  positiveMediaIds: new Set(),
  negativeMediaIds: new Set(),
  signalCount: 15,
}

// Profile B: loves Romance + Comedy
const TASTE_B: TasteSignals = {
  genreScores: { [GENRE_ROMANCE]: 5, [GENRE_COMEDY]: 4, [GENRE_SCI_FI]: 0, [GENRE_ACTION]: 0 },
  genreNames: { [GENRE_ROMANCE]: 'Romance', [GENRE_COMEDY]: 'Comedy' },
  positiveMediaIds: new Set(),
  negativeMediaIds: new Set(),
  signalCount: 15,
}

const QUERY_PLAN_SCIFI = {
  schemaVersion: '1' as const,
  rawQuery: 'space movies',
  displayTitle: 'Space Movies',
  semanticIntent: 'science fiction space exploration movies',
  desiredThemes: ['space', 'ai'],
  desiredTone: [],
  avoidSignals: [],
  mediaTypes: [] as ('MOVIE' | 'SERIES')[],
  hardFilters: {},
  softPreferences: { preferredDirectors: ['Denis Villeneuve'] },
  userConstraints: [],
  plannerFallback: false,
  plannerMeta: null,
}

const QUERY_PLAN_WITH_RUNTIME_FILTER = {
  ...QUERY_PLAN_SCIFI,
  hardFilters: { maxRuntimeMinutes: 120 },
}

// ─── vector-only ordering (sort by similarity desc) ───────────────────────────

function vectorOnlyOrder(candidates: HybridCandidate[]): string[] {
  return [...candidates]
    .sort((a, b) => b.similarity - a.similarity || a.mediaId.localeCompare(b.mediaId))
    .map((c) => c.mediaId)
}

// ─────────────────────────────────────────────────────────────────────────────

describe('benchmark — vector-only vs hybrid vs hybrid-with-diversity', () => {
  it('hybrid ordering differs from vector-only for Profile A (personalisation matters)', () => {
    const vectorOrder = vectorOnlyOrder(CANDIDATES)
    const hybridOrder = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_A, {
      diversityEnabled: false,
      limit: 20,
    }).map((c) => c.mediaId)

    expect(hybridOrder).not.toEqual(vectorOrder.slice(0, hybridOrder.length))
  })

  it('Profile A and Profile B produce top-5 overlap ≤ 3 on the same pool', () => {
    const opts = { diversityEnabled: false, limit: 10 }
    const top5A = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_A, opts)
      .slice(0, 5)
      .map((c) => c.mediaId)
    const top5B = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_B, opts)
      .slice(0, 5)
      .map((c) => c.mediaId)

    const setA = new Set(top5A)
    const overlap = top5B.filter((id) => setA.has(id)).length
    expect(overlap).toBeLessThanOrEqual(3)
  })

  it('hard filter maxRuntimeMinutes is respected identically across all three pipelines', () => {
    const longIds = CANDIDATES.filter((c) => (c.durationMinutes ?? 0) > 120).map((c) => c.mediaId)
    expect(longIds.length).toBeGreaterThan(0) // fixture sanity check

    // vector-only: no filtering
    const vectorOrder = vectorOnlyOrder(CANDIDATES)
    for (const id of longIds) {
      expect(vectorOrder).toContain(id)
    }

    // hybrid with runtime filter: long items removed
    const hybridFiltered = rankHybrid(CANDIDATES, QUERY_PLAN_WITH_RUNTIME_FILTER, TASTE_A, {
      diversityEnabled: false,
      limit: 20,
    }).map((c) => c.mediaId)

    for (const id of longIds) {
      expect(hybridFiltered).not.toContain(id)
    }

    // hybrid-with-diversity also removes them
    const hybridDiversity = rankHybrid(CANDIDATES, QUERY_PLAN_WITH_RUNTIME_FILTER, TASTE_A, {
      diversityEnabled: true,
      limit: 20,
    }).map((c) => c.mediaId)

    for (const id of longIds) {
      expect(hybridDiversity).not.toContain(id)
    }
  })

  it('diversity prevents COLLECTION_FRANCHISE from dominating top-10', () => {
    const franchiseIds = CANDIDATES.filter((c) => c.collectionId === COLLECTION_FRANCHISE).map(
      (c) => c.mediaId,
    )
    expect(franchiseIds.length).toBeGreaterThan(2)

    const result = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_A, {
      diversityEnabled: true,
      maxPerCollection: 2,
      limit: 10,
    })

    const franchiseInTop10 = result.slice(0, 10).filter((c) => c.collectionId === COLLECTION_FRANCHISE)
    expect(franchiseInTop10.length).toBeLessThanOrEqual(2)
  })

  it('diversity:false allows franchise to appear more than twice in top positions', () => {
    const result = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_A, {
      diversityEnabled: false,
      limit: 10,
    })

    const franchiseInTop10 = result.slice(0, 10).filter(
      (c) => c.collectionId === COLLECTION_FRANCHISE,
    ).length
    // Sci-fi franchise items have high similarity — without diversity cap they dominate
    expect(franchiseInTop10).toBeGreaterThan(2)
  })

  it('debug mode attaches scoreBreakdown with modelVersion=v1 to every result', () => {
    const result = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_A, {
      debug: true,
      diversityEnabled: false,
      limit: 10,
    })

    for (const c of result) {
      expect(c.scoreBreakdown).toBeDefined()
      expect(c.scoreBreakdown!.modelVersion).toBe('v1')
      expect(c.scoreBreakdown!.reasons.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('scoreBreakdown.final is mathematically reconstructible from its component fields', () => {
    const w = SCORE_MODEL_V1
    const result = rankHybrid(CANDIDATES, QUERY_PLAN_SCIFI, TASTE_A, {
      debug: true,
      diversityEnabled: false,
      limit: 20,
    })

    for (const c of result) {
      const bd = c.scoreBreakdown!
      const reconstructed =
        bd.semantic * w.wSemantic +
        bd.genreAffinity * w.wGenre +
        bd.themeAffinity * w.wTheme +
        bd.peopleAffinity * w.wPeople +
        bd.freshness * w.wFreshness +
        bd.qualityPrior * w.wPrior +
        bd.availabilityBonus * w.wAvailability -
        bd.alreadyWatchedPenalty -
        bd.abandonPenalty -
        bd.dislikedPenalty -
        bd.avoidPenalty -
        bd.repetitionPenalty
      expect(bd.final).toBeCloseTo(reconstructed, 10)
    }
  })
})
