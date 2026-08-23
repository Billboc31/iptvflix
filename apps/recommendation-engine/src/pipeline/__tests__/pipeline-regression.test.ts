import 'dotenv/config'
import { describe, it, expect, vi } from 'vitest'
import type { FastifyBaseLogger } from 'fastify'
import { runPipeline } from '../pipeline.js'
import { runRecommendationFromPlan } from '../recommendation-service.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { SEMANTIC_FLOOR_MODERATE } from '../../config.js'

// These tests require a populated embedding index and OPENAI_API_KEY.
// They are skipped automatically when OPENAI_API_KEY is not configured.
const canRun = !!process.env.OPENAI_API_KEY && !!process.env.DATABASE_URL

const mockLog = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
  fatal: vi.fn(),
  silent: vi.fn(),
  child: vi.fn(),
} as unknown as FastifyBaseLogger

function makeRegressionPlan(
  intent: string,
  semanticProtection?: 'strict' | 'moderate' | 'none',
  semanticAnchor?: string,
): RecommendationQueryPlan {
  return {
    schemaVersion: '1',
    rawQuery: intent,
    displayTitle: intent,
    semanticIntent: intent,
    semanticAnchor: semanticAnchor ?? null,
    desiredThemes: [],
    desiredTone: [],
    avoidSignals: [],
    mediaTypes: ['MOVIE', 'SERIES'],
    hardFilters: {},
    softPreferences: {},
    userConstraints: [],
    plannerFallback: true,
    semanticProtection,
    plannerMeta: null,
  }
}

describe('T117/T121 — non-regression: runRecommendationFromPlan on reference intents', () => {
  it.skipIf(!canRun)(
    '"Aventures à travers le temps" — top-5 dominated by semantic relevance',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan('Aventures à travers le temps', 'moderate'),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-aventures',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)
      expect(result.results.every((r) => r.title && r.id), 'all results must have id and title').toBe(true)

      // No top-5 result should have a sub-floor semantic score
      const top5 = result.results.slice(0, 5)
      expect(
        top5.every((r) => (r.scoreBreakdown?.semantic ?? 0) >= SEMANTIC_FLOOR_MODERATE),
        'all top-5 results must have semantic >= SEMANTIC_FLOOR_MODERATE',
      ).toBe(true)

      // At least 3 of top-10 should have semanticContribution > profileContribution
      const top10 = result.results.slice(0, 10)
      const semanticDominant = top10.filter(
        (r) => (r.scoreBreakdown?.semanticContribution ?? 0) > (r.scoreBreakdown?.profileContribution ?? Infinity),
      )
      expect(
        semanticDominant.length,
        'at least 3 top-10 results must have semanticContribution > profileContribution',
      ).toBeGreaterThanOrEqual(3)

      // T122: at least 4 of top-8 must be temporally themed titles
      const timeKeywords = ['time', 'chrono', 'visitor', 'timescape', 'lapse']
      const isTemporalTitle = (title: string) =>
        timeKeywords.some((kw) => title.toLowerCase().includes(kw))
      const top8 = result.results.slice(0, 8)
      const temporalInTop8 = top8.filter((r) => isTemporalTitle(r.title))
      expect(
        temporalInTop8.length,
        'at least 4 of top-8 results must be temporal titles (Time/Chrono/Visitor/Timescape/Lapse)',
      ).toBeGreaterThanOrEqual(4)

      // T122: The Hobbit must not appear in top-5 (profile-only boost must not rescue a semantically weak candidate)
      expect(
        top5.every((r) => !r.title.includes('Hobbit')),
        'The Hobbit must not appear in top-5 (semantic modulation must prevent profile-only rescue)',
      ).toBe(true)

      // T122: modulation is active — at least 3 candidates must have profileBoostEffective < profileBoostRaw
      const modulated = result.results.filter(
        (r) => (r.scoreBreakdown?.profileBoostEffective ?? 0) < (r.scoreBreakdown?.profileBoostRaw ?? 0) - 0.001,
      )
      expect(
        modulated.length,
        'at least 3 results must have profileBoostEffective < profileBoostRaw (modulation is active)',
      ).toBeGreaterThanOrEqual(3)
    },
    30_000,
  )

  it.skipIf(!canRun)(
    '"Épopées modernes" — returns ≥ 5 results',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan('Épopées modernes'),
        { mediaTypes: ['movie', 'series'], limit: 10 },
        'regression-epopees',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)
      expect(result.results.every((r) => r.title && r.id), 'all results must have id and title').toBe(true)
    },
    30_000,
  )

  it.skipIf(!canRun)(
    '"film qui retourne le cerveau" — top-5 semantic scores within narrow range (no extreme outliers)',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan('film qui retourne le cerveau', 'moderate'),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-cerveau',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)
      expect(result.results.every((r) => r.title && r.id), 'all results must have id and title').toBe(true)

      // No top-5 result with sub-floor semantic score
      const top5 = result.results.slice(0, 5)
      expect(
        top5.every((r) => (r.scoreBreakdown?.semantic ?? 0) >= SEMANTIC_FLOOR_MODERATE),
        'all top-5 results must have semantic >= SEMANTIC_FLOOR_MODERATE',
      ).toBe(true)

      // Semantic scores in top-5 should not have extreme outliers (profile alone cannot rescue a weak candidate)
      const semanticScores = top5.map((r) => r.scoreBreakdown?.semantic ?? 0)
      const maxSemantic = Math.max(...semanticScores)
      const minSemantic = Math.min(...semanticScores)
      expect(
        maxSemantic - minSemantic,
        'top-5 semantic score spread must be < 0.25 (no extreme outlier saved by profile alone)',
      ).toBeLessThan(0.25)

      // T122: breakdown fields are populated and modulation constraint is respected
      expect(
        result.results.every((r) => r.scoreBreakdown?.semanticConfidenceFactor !== undefined),
        'all results must have semanticConfidenceFactor in breakdown',
      ).toBe(true)
      expect(
        result.results.every(
          (r) => (r.scoreBreakdown?.profileBoostEffective ?? 0) <= (r.scoreBreakdown?.profileBoostRaw ?? 0) + 0.001,
        ),
        'profileBoostEffective must not exceed profileBoostRaw for any candidate',
      ).toBe(true)
    },
    30_000,
  )

  it.skipIf(!canRun)(
    '"SF qui fait réfléchir" — top-5 dominated by semantic relevance',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan('SF qui fait réfléchir', 'moderate'),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-sf',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)

      // No top-5 result with sub-floor semantic score
      const top5 = result.results.slice(0, 5)
      expect(
        top5.every((r) => (r.scoreBreakdown?.semantic ?? 0) >= SEMANTIC_FLOOR_MODERATE),
        'all top-5 results must have semantic >= SEMANTIC_FLOOR_MODERATE',
      ).toBe(true)

      // T122: top-5 must have semanticConfidenceFactor populated — high-semantic candidates should score > 0.5
      expect(
        top5.every((r) => (r.scoreBreakdown?.semanticConfidenceFactor ?? -1) > 0),
        'all top-5 results must have semanticConfidenceFactor > 0 in breakdown',
      ).toBe(true)
      // T122: modulation constraint — effective boost never exceeds raw boost
      expect(
        result.results.every(
          (r) => (r.scoreBreakdown?.profileBoostEffective ?? 0) <= (r.scoreBreakdown?.profileBoostRaw ?? 0) + 0.001,
        ),
        'profileBoostEffective must not exceed profileBoostRaw for any candidate',
      ).toBe(true)
    },
    30_000,
  )
})

describe('T123 — semantic anchor blend: compound thematic precision', () => {
  it.skipIf(!canRun)(
    '"Aventures à travers le temps" with anchor — temporal candidates dominate, false positives absent from top-5',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan(
          'Aventures à travers le temps — specifically about time travel and temporal displacement, not merely adventure or journey',
          'moderate',
          'time travel and temporal displacement',
        ),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-t123-aventures',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)

      // At least 4 of top-8 must be temporal-themed
      const timeKeywords = ['time', 'chrono', 'visitor', 'timescape', 'lapse', 'temporal']
      const isTemporalTitle = (title: string) =>
        timeKeywords.some((kw) => title.toLowerCase().includes(kw))
      const top8 = result.results.slice(0, 8)
      const temporalInTop8 = top8.filter((r) => isTemporalTitle(r.title))
      expect(
        temporalInTop8.length,
        'at least 4 of top-8 results must be temporal titles (Time/Chrono/Visitor/Timescape/Lapse/Temporal)',
      ).toBeGreaterThanOrEqual(4)

      // Known false positives (adventure/travel without temporal component) must not appear in top-5
      const top5 = result.results.slice(0, 5)
      const falsePositiveTitles = ["L'Avventura", 'France, le fabuleux voyage', 'Mystery at the Louvre', 'Treasure Island']
      const falsePositivesInTop5 = top5.filter((r) =>
        falsePositiveTitles.some((fp) => r.title.toLowerCase().includes(fp.toLowerCase().split(',')[0]!.toLowerCase())),
      )
      expect(
        falsePositivesInTop5.length,
        'known adventure/travel false positives must not appear in top-5 when anchor is active',
      ).toBe(0)

      // All top-5 must pass semantic floor
      expect(
        top5.every((r) => (r.scoreBreakdown?.semantic ?? 0) >= SEMANTIC_FLOOR_MODERATE),
        'all top-5 results must have semantic >= SEMANTIC_FLOOR_MODERATE',
      ).toBe(true)
    },
    30_000,
  )

  it.skipIf(!canRun)(
    '"Enquêtes policières dans l\'espace" with anchor — space-detective candidates dominate over pure space or pure detective results',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan(
          "Enquêtes policières dans l'espace — specifically about detective investigations and crime-solving set in outer space or sci-fi space stations, not merely space exploration or crime thrillers on Earth",
          'moderate',
          'police detective investigation in outer space',
        ),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-t123-enquetes-espace',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)

      // All top-5 must pass semantic floor
      const top5 = result.results.slice(0, 5)
      expect(
        top5.every((r) => (r.scoreBreakdown?.semantic ?? 0) >= SEMANTIC_FLOOR_MODERATE),
        'all top-5 results must have semantic >= SEMANTIC_FLOOR_MODERATE',
      ).toBe(true)

      // semanticConfidenceFactor must be populated
      expect(
        result.results.every((r) => r.scoreBreakdown?.semanticConfidenceFactor !== undefined),
        'all results must have semanticConfidenceFactor in breakdown',
      ).toBe(true)

      // Modulation constraint: effective boost never exceeds raw boost
      expect(
        result.results.every(
          (r) => (r.scoreBreakdown?.profileBoostEffective ?? 0) <= (r.scoreBreakdown?.profileBoostRaw ?? 0) + 0.001,
        ),
        'profileBoostEffective must not exceed profileBoostRaw for any candidate',
      ).toBe(true)
    },
    30_000,
  )
})

describe('pipeline regression — retrieval pool larger than final shelf', () => {
  it.skipIf(!canRun)(
    'WATCH_NOW: semantic outputCount >= 100 and results <= 30',
    async () => {
      const response = await runPipeline(
        { text: 'films populaires du moment à regarder ce soir', limit: 20, debug: true },
        'test-watch-now',
        mockLog,
      )

      const semanticStage = response.stageOutputs.find((s) => s.stage === 'semantic-search')
      const rerankerStage = response.stageOutputs.find((s) => s.stage === 'hybrid-reranker')

      expect(semanticStage?.available, 'semantic-search stage must be available').toBe(true)
      expect(semanticStage?.outputCount, 'retrieval pool must be >= 100').toBeGreaterThanOrEqual(100)
      expect(response.results.length, 'final shelf must be <= 30').toBeLessThanOrEqual(30)
      expect(rerankerStage?.filteredCount, 'filteredCount must be defined').toBeDefined()
      expect(rerankerStage?.filteredCount ?? Infinity, 'filteredCount must be <= semantic outputCount').toBeLessThanOrEqual(semanticStage?.outputCount ?? 0)
    },
    30_000,
  )

  it.skipIf(!canRun)(
    'DISCOVERY: "SF qui fait réfléchir" — pool >= 100, final <= 30, filteredCount present',
    async () => {
      const response = await runPipeline(
        { text: 'SF qui fait réfléchir', limit: 20, debug: true },
        'test-discovery',
        mockLog,
      )

      const semanticStage = response.stageOutputs.find((s) => s.stage === 'semantic-search')
      const rerankerStage = response.stageOutputs.find((s) => s.stage === 'hybrid-reranker')

      expect(semanticStage?.available, 'semantic-search stage must be available').toBe(true)
      expect(semanticStage?.outputCount, 'retrieval pool must be >= 100').toBeGreaterThanOrEqual(100)
      expect(response.results.length, 'final shelf must be <= 30').toBeLessThanOrEqual(30)
      expect(rerankerStage?.filteredCount, 'filteredCount must be defined').toBeDefined()
      expect(rerankerStage?.filteredCount ?? Infinity, 'filteredCount must be <= semantic outputCount').toBeLessThanOrEqual(semanticStage?.outputCount ?? 0)
    },
    30_000,
  )

  it.skipIf(!canRun)(
    'mixed movie+series: pool >= 100, final <= 30, filteredCount present',
    async () => {
      const response = await runPipeline(
        { text: 'aventures épiques films et séries', mediaTypes: ['movie', 'series'], limit: 24, debug: true },
        'test-mixed',
        mockLog,
      )

      const semanticStage = response.stageOutputs.find((s) => s.stage === 'semantic-search')
      const rerankerStage = response.stageOutputs.find((s) => s.stage === 'hybrid-reranker')

      expect(semanticStage?.available, 'semantic-search stage must be available').toBe(true)
      expect(semanticStage?.outputCount, 'retrieval pool must be >= 100').toBeGreaterThanOrEqual(100)
      expect(response.results.length, 'final shelf must be <= 30').toBeLessThanOrEqual(30)
      expect(rerankerStage?.filteredCount, 'filteredCount must be defined').toBeDefined()
      expect(rerankerStage?.filteredCount ?? Infinity, 'filteredCount must be <= semantic outputCount').toBeLessThanOrEqual(semanticStage?.outputCount ?? 0)
    },
    30_000,
  )
})
