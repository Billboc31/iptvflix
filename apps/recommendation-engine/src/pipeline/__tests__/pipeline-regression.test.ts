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

function makeRegressionPlan(intent: string): RecommendationQueryPlan {
  return {
    schemaVersion: '1',
    rawQuery: intent,
    displayTitle: intent,
    semanticIntent: intent,
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
