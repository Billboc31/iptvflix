/**
 * E2E integration test for T113 — retrieval pool architecture.
 *
 * Demonstrates the retrieve-200 → hard-filter → truncate-to-shelf pipeline
 * using the real local DB with synthetic (random) embeddings. OpenAI is not
 * called; the point is to prove the SQL LIMIT 200, passesHardFilters, and
 * final truncation all wire together correctly.
 *
 * Seed layout (200 series, controlled metadata for predictable filter counts):
 *   Batch A — 80 series, year=2020, lang='fr'
 *   Batch B — 70 series, year=2005, lang='en'   (old → filtered by minReleaseYear=2015)
 *   Batch C — 50 series, year=2018, lang=null    (year ok, lang unknown → excluded by audioLanguages)
 *
 * Expected counts per query scenario:
 *   WATCH_NOW  (no hard filters)             : filtered=200, final=20
 *   DISCOVERY  (minReleaseYear=2015)         : filtered=130, final=20   (A+C pass year; B fail)
 *   MIXED      (audioLanguages=['fr'])        : filtered=80,  final=20   (only A passes)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'
import { pgClient, db } from '../../db/client.js'
import { series } from '../../db/schema.js'
import { passesHardFilters } from '../stages/hybrid-reranker.js'
import type { EnrichedCandidate } from '../stages/hybrid-reranker.js'
import { SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP } from '../../config.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const TEST_MODEL_PROVIDER = 'test'
const TEST_MODEL_NAME = 'e2e-pool-t113-v1'
const TEST_DIM = 8

const BATCH_A = 80   // year=2020, lang='fr'
const BATCH_B = 70   // year=2005, lang='en'
const BATCH_C = 50   // year=2018, lang=null
const TOTAL_SEED = BATCH_A + BATCH_B + BATCH_C // 200

const FINAL_LIMIT = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

function randomVec(dim: number): number[] {
  const v = Array.from({ length: dim }, () => Math.random() - 0.5)
  const mag = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return v.map(x => x / mag)
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
    plannerFallback: true,
    plannerMeta: null,
  }
}

type SeedInfo = { id: string; year: number | null; lang: string | null }

function toEnriched(s: SeedInfo): EnrichedCandidate {
  return {
    id: s.id,
    mediaType: 'series',
    title: 'test',
    year: s.year,
    posterPath: null,
    score: 1,
    similarity: 1,
    reasons: [],
    scoreBreakdown: {},
    genreIds: [],
    genreNames: [],
    available: true,
    collectionId: null,
    directors: [],
    keywords: [],
    durationMinutes: null,
    originalLanguage: s.lang,
    popularity: null,
    voteAverage: null,
    completionRatio: null,
    exposureCount: 0,
  }
}

// ─── Seed / teardown ──────────────────────────────────────────────────────────

let seeds: SeedInfo[] = []
const retrievalLimit = Math.min(SEMANTIC_RETRIEVAL_LIMIT, SEMANTIC_RETRIEVAL_MAX_CAP)

beforeAll(async () => {
  const batchDefs = [
    ...Array.from({ length: BATCH_A }, (_, i) => ({ title: `T113_E2E_A${i}`, firstAirYear: 2020 as number | undefined, originalLanguage: 'fr' as string | undefined })),
    ...Array.from({ length: BATCH_B }, (_, i) => ({ title: `T113_E2E_B${i}`, firstAirYear: 2005 as number | undefined, originalLanguage: 'en' as string | undefined })),
    ...Array.from({ length: BATCH_C }, (_, i) => ({ title: `T113_E2E_C${i}`, firstAirYear: 2018 as number | undefined, originalLanguage: undefined })),
  ]

  const inserted = await db.insert(series).values(batchDefs).returning({ id: series.id })

  seeds = inserted.map((row, i) => {
    const def = batchDefs[i]!
    return { id: row.id, year: def.firstAirYear ?? null, lang: def.originalLanguage ?? null }
  })

  // Insert embeddings one-by-one (200 rows × 8 dims — fast enough)
  for (const s of seeds) {
    const vec = randomVec(TEST_DIM)
    await pgClient`
      INSERT INTO media_embeddings
        (media_id, media_type, embedding, model_provider, model_name, embedding_dimension, doc_hash, generated_at)
      VALUES
        (${s.id}, 'series', ${vec}, ${TEST_MODEL_PROVIDER}, ${TEST_MODEL_NAME}, ${TEST_DIM}, ${'e2e-' + s.id}, now())
      ON CONFLICT (media_id, media_type, model_provider, model_name) DO NOTHING
    `
  }
}, 90_000)

afterAll(async () => {
  if (seeds.length === 0) return
  const ids = seeds.map(s => s.id)
  await pgClient`DELETE FROM media_embeddings WHERE model_provider = ${TEST_MODEL_PROVIDER} AND model_name = ${TEST_MODEL_NAME}`
  await pgClient`DELETE FROM series WHERE id = ANY(${ids}::uuid[])`
  seeds = []
}, 30_000)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T113 — retrieval pool e2e (synthetic embeddings, real DB)', () => {
  it('config: retrievalLimit is 200 (decoupled from final shelf limit)', () => {
    expect(retrievalLimit).toBe(200)
    expect(FINAL_LIMIT).toBeLessThanOrEqual(30)
  })

  it('SQL: retrieves full pool of 200 from media_embeddings (LIMIT retrievalLimit)', async () => {
    const rows = await pgClient<{ media_id: string }[]>`
      SELECT me.media_id
      FROM media_embeddings me
      WHERE me.model_provider = ${TEST_MODEL_PROVIDER}
        AND me.model_name = ${TEST_MODEL_NAME}
        AND me.media_type = 'series'
      LIMIT ${retrievalLimit}
    `
    expect(rows.length).toBe(TOTAL_SEED)
    expect(rows.length).toBe(retrievalLimit)
  })

  it('WATCH_NOW — no hard filters: retrieved=200, filtered=200, final=20', () => {
    const pool = seeds.map(toEnriched)
    const plan = makePlan({})
    const filtered = pool.filter(c => passesHardFilters(c, plan))
    const final = filtered.slice(0, FINAL_LIMIT)

    expect(pool.length).toBe(TOTAL_SEED)       // retrieved: 200
    expect(filtered.length).toBe(TOTAL_SEED)   // filtered:  200 (no hard filters)
    expect(final.length).toBe(FINAL_LIMIT)     // final:     20
    expect(final.length).toBeLessThanOrEqual(30)
  })

  it('DISCOVERY "SF qui fait réfléchir" — minReleaseYear=2015: retrieved=200, filtered=130, final=20', () => {
    const pool = seeds.map(toEnriched)
    const plan = makePlan({ minReleaseYear: 2015 })

    // Batch A (year=2020 ≥ 2015): pass
    // Batch B (year=2005 < 2015): fail
    // Batch C (year=2018 ≥ 2015): pass
    // Expected filteredCount = BATCH_A + BATCH_C = 80 + 50 = 130
    const filtered = pool.filter(c => passesHardFilters(c, plan))
    const final = filtered.slice(0, FINAL_LIMIT)

    expect(pool.length).toBe(TOTAL_SEED)              // retrieved: 200
    expect(filtered.length).toBe(BATCH_A + BATCH_C)  // filtered:  130
    expect(filtered.length).toBeLessThan(pool.length)
    expect(final.length).toBe(FINAL_LIMIT)            // final:     20
    expect(final.length).toBeLessThanOrEqual(30)
  })

  it('MIXED "aventures épiques films et séries" — audioLanguages=[fr]: retrieved=200, filtered=80, final=20', () => {
    const pool = seeds.map(toEnriched)
    const plan = makePlan({ audioLanguages: ['fr'] })

    // Batch A (lang='fr'): pass
    // Batch B (lang='en' not in ['fr']): fail
    // Batch C (lang=null — STRICT_EXCLUDE_UNKNOWN): fail
    // Expected filteredCount = BATCH_A = 80
    const filtered = pool.filter(c => passesHardFilters(c, plan))
    const final = filtered.slice(0, FINAL_LIMIT)

    expect(pool.length).toBe(TOTAL_SEED)    // retrieved: 200
    expect(filtered.length).toBe(BATCH_A)  // filtered:  80
    expect(final.length).toBe(FINAL_LIMIT) // final:     20
    expect(final.length).toBeLessThanOrEqual(30)
  })
})
