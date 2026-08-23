import 'dotenv/config'
import { describe, it, expect, vi } from 'vitest'
import type { FastifyBaseLogger } from 'fastify'
import { runPipeline } from '../pipeline.js'
import { runRecommendationFromPlan } from '../recommendation-service.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'

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

function makeRegressionPlan(intent: string, semanticAnchor?: string): RecommendationQueryPlan {
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
    plannerMeta: null,
  }
}

describe('T117 — non-regression: runRecommendationFromPlan on reference intents', () => {
  it.skipIf(!canRun)(
    '"Aventures à travers le temps" — returns ≥ 5 results',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan('Aventures à travers le temps'),
        { mediaTypes: ['movie', 'series'], limit: 10 },
        'regression-aventures',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)
      expect(result.results.every((r) => r.title && r.id), 'all results must have id and title').toBe(true)
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
    '"film qui retourne le cerveau" — returns ≥ 5 results',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan('film qui retourne le cerveau'),
        { mediaTypes: ['movie', 'series'], limit: 10 },
        'regression-cerveau',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)
      expect(result.results.every((r) => r.title && r.id), 'all results must have id and title').toBe(true)
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
          'time travel and temporal displacement',
        ),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-t123-aventures',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)

      // At least 4 of top-8 must be temporal-themed (keyword match on title)
      // 'time' is intentional: matches "Time Machine", "Timescape", "Time Lapse", etc.
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
    },
    30_000,
  )

  it.skipIf(!canRun)(
    '"Enquêtes policières dans l\'espace" with anchor — space-detective candidates dominate over pure space or pure detective results',
    async () => {
      const result = await runRecommendationFromPlan(
        makeRegressionPlan(
          "Enquêtes policières dans l'espace — specifically about detective investigations and crime-solving set in outer space or sci-fi space stations, not merely space exploration or crime thrillers on Earth",
          'police detective investigation in outer space',
        ),
        { mediaTypes: ['movie', 'series'], limit: 20, debug: true },
        'regression-t123-enquetes-espace',
        mockLog,
      )
      expect(result.results.length, 'must return at least 5 results').toBeGreaterThanOrEqual(5)

      // At least 3 of top-8 must contain keywords from BOTH the space domain AND the detective/crime domain,
      // indicating the anchor blend is surfacing composite candidates rather than single-theme matches.
      const spaceKeywords = ['space', 'espace', 'galactic', 'galactique', 'stellar', 'cosmos', 'astro', 'orbit', 'lunar', 'star']
      const crimeKeywords = ['detective', 'détective', 'policier', 'enquête', 'crime', 'criminal', 'murder', 'meurtre', 'investigation', 'inspector']
      const isSpaceTitle = (title: string) => spaceKeywords.some((kw) => title.toLowerCase().includes(kw))
      const isCrimeTitle = (title: string) => crimeKeywords.some((kw) => title.toLowerCase().includes(kw))
      const isCompositeTitle = (title: string) => isSpaceTitle(title) && isCrimeTitle(title)

      const top8 = result.results.slice(0, 8)
      const compositeInTop8 = top8.filter((r) => isCompositeTitle(r.title))
      expect(
        compositeInTop8.length,
        'at least 3 of top-8 must match both space AND crime/detective keywords (compound theme dominates)',
      ).toBeGreaterThanOrEqual(3)

      // Pure-space titles (no crime element) and pure-detective titles (no space element) must not
      // collectively dominate the top-5 — i.e., at most 2 of top-5 may be single-theme only.
      const top5 = result.results.slice(0, 5)
      const singleThemeInTop5 = top5.filter(
        (r) => (isSpaceTitle(r.title) || isCrimeTitle(r.title)) && !isCompositeTitle(r.title),
      )
      expect(
        singleThemeInTop5.length,
        'pure-space or pure-detective single-theme results must not dominate top-5 (at most 2 allowed)',
      ).toBeLessThanOrEqual(2)
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
