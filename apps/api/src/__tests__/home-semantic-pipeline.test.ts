import 'dotenv/config'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../db/client.js'
import { profiles, shelfConcepts, shelfInstances, shelfInstanceItems, recommendationHomeSessions } from '../db/schema/index.js'
import { eq, inArray } from 'drizzle-orm'
import { RecommendationEngineClient } from '../client/recommendation-engine-client.js'
import { fillPoolAsync } from '../services/home-pool-service.js'

// ---------------------------------------------------------------------------
// Jaccard similarity helper
// ---------------------------------------------------------------------------

function jaccard(a: string[], b: string[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  const intersection = [...setA].filter((x) => setB.has(x)).length
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 1 : intersection / union
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// Three concepts used in Suite 1 (direct divergence test).
const CONCEPT_TEXTS = [
  'SF qui fait réfléchir',
  "Comédies légères familiales",
  "Thrillers en huis clos où personne n'est fiable",
]

// Ten concepts inserted for Suite 2 (end-to-end pipeline; Completion rule requires ≥ 10 shelves).
const ALL_CONCEPT_TEXTS = [
  ...CONCEPT_TEXTS,
  'Drames historiques épiques',
  'Animations japonaises pour adolescents',
  'Documentaires nature et environnement',
  'Romances contemporaines feel-good',
  "Films d'action avec des cascades spectaculaires",
  'Horreur psychologique atmosphérique',
  'Polars nordiques sombres',
]

// A profile that likely has no taste signals — ensures divergence comes from semantics only.
const PROBE_PROFILE_ID = '00000000-0000-0000-0000-000000000001'

let createdProfileId: string | null = null
let createdConceptIds: string[] = []
let createdSessionId: string | null = null

const engineAvailable = RecommendationEngineClient.isConfigured()

beforeAll(async () => {
  if (!engineAvailable) return

  const [profile] = await db
    .insert(profiles)
    .values({ name: 'test-semantic-pipeline', isKids: false })
    .returning({ id: profiles.id })
  createdProfileId = profile.id

  const inserted = await db
    .insert(shelfConcepts)
    .values(
      ALL_CONCEPT_TEXTS.map((text) => ({
        profileId: createdProfileId!,
        title: text,
        rawIntent: text,
        semanticIntent: text,
        generationType: 'PERSONALIZED' as const,
        reasonCodes: [] as string[],
        sourceModel: 'test',
        promptVersion: 'test',
        desiredMediaTypes: ['MOVIE', 'SERIES'] as string[],
        freshnessPolicy: null,
        active: true,
      })),
    )
    .returning({ id: shelfConcepts.id })
  createdConceptIds = inserted.map((r) => r.id)
}, 10_000)

afterAll(async () => {
  if (!createdProfileId) return

  if (createdSessionId) {
    const instanceRows = await db
      .select({ id: shelfInstances.id })
      .from(shelfInstances)
      .where(eq(shelfInstances.homeSessionId, createdSessionId))

    if (instanceRows.length > 0) {
      const ids = instanceRows.map((r) => r.id)
      await db.delete(shelfInstanceItems).where(inArray(shelfInstanceItems.shelfInstanceId, ids))
      await db.delete(shelfInstances).where(inArray(shelfInstances.id, ids))
    }

    await db.delete(recommendationHomeSessions).where(eq(recommendationHomeSessions.id, createdSessionId))
  }

  if (createdConceptIds.length > 0) {
    await db.delete(shelfConcepts).where(inArray(shelfConcepts.id, createdConceptIds))
  }

  await db.delete(profiles).where(eq(profiles.id, createdProfileId))
}, 10_000)

// ---------------------------------------------------------------------------
// Suite 1: Direct semantic query — concept divergence
// ---------------------------------------------------------------------------

describe('queryForShelf — concept divergence', () => {
  it.skipIf(!engineAvailable)(
    'three distinct concepts produce Jaccard < 0.3 between any top-5 pair',
    async () => {
      const results = await Promise.all(
        CONCEPT_TEXTS.map((text) =>
          RecommendationEngineClient.queryForShelf({
            text,
            profileId: PROBE_PROFILE_ID,
            limit: 20,
          }),
        ),
      )

      for (const r of results) {
        expect(r, 'engine returned null — is RECOMMENDATION_ENGINE_URL set?').not.toBeNull()
      }

      const candidateSets = results.map((r) =>
        (r?.candidates ?? []).slice(0, 5).map((c) => c.mediaId),
      )

      for (let i = 0; i < candidateSets.length; i++) {
        for (let j = i + 1; j < candidateSets.length; j++) {
          const sim = jaccard(candidateSets[i], candidateSets[j])
          expect(
            sim,
            `Concepts "${CONCEPT_TEXTS[i]}" and "${CONCEPT_TEXTS[j]}" top-5 Jaccard = ${sim.toFixed(2)} (must be < 0.3)`,
          ).toBeLessThan(0.3)
        }
      }
    },
    30_000,
  )

  it.skipIf(!engineAvailable)(
    'at least one item per result has semanticScore > 0',
    async () => {
      const result = await RecommendationEngineClient.queryForShelf({
        text: CONCEPT_TEXTS[0],
        profileId: PROBE_PROFILE_ID,
        limit: 10,
      })
      expect(result).not.toBeNull()
      const hasSemanticScore = result!.candidates.some((c) => c.semanticScore > 0)
      expect(hasSemanticScore, 'expected at least one item with semanticScore > 0').toBe(true)
    },
    15_000,
  )

  it.skipIf(!engineAvailable)(
    'queryForShelf returns non-empty version metadata',
    async () => {
      const result = await RecommendationEngineClient.queryForShelf({
        text: CONCEPT_TEXTS[0],
        profileId: PROBE_PROFILE_ID,
        limit: 5,
      })
      expect(result).not.toBeNull()
      expect(result!.queryPlannerVersion).toBeTruthy()
      expect(result!.embeddingModelVersion).toBeTruthy()
      expect(result!.rankerVersion).toBeTruthy()
    },
    15_000,
  )
})

// ---------------------------------------------------------------------------
// Suite 2: fillPoolAsync — each concept routes through its own semantic query
// ---------------------------------------------------------------------------

describe('fillPoolAsync — semantic pipeline end-to-end', () => {
  it.skipIf(!engineAvailable)(
    'generates shelves with distinct item sets and full provenance',
    async () => {
      if (!createdProfileId) throw new Error('profile fixture not created')

      const [session] = await db
        .insert(recommendationHomeSessions)
        .values({
          profileId: createdProfileId,
          expiresAt: new Date(Date.now() + 3_600_000),
          modelVersion: 'v1',
        })
        .returning({ id: recommendationHomeSessions.id })
      createdSessionId = session.id

      await fillPoolAsync(session.id, createdProfileId, 10)

      const instances = await db
        .select({
          id: shelfInstances.id,
          shelfConceptId: shelfInstances.shelfConceptId,
          semanticIntentSnapshot: shelfInstances.semanticIntentSnapshot,
          queryPlannerVersion: shelfInstances.queryPlannerVersion,
          embeddingModelVersion: shelfInstances.embeddingModelVersion,
          rankerVersion: shelfInstances.rankerVersion,
        })
        .from(shelfInstances)
        .where(eq(shelfInstances.homeSessionId, session.id))

      expect(instances.length, 'expected at least 10 shelves to be generated').toBeGreaterThanOrEqual(10)

      for (const inst of instances) {
        expect(inst.queryPlannerVersion, `queryPlannerVersion null on ${inst.id}`).toBeTruthy()
        expect(inst.embeddingModelVersion, `embeddingModelVersion null on ${inst.id}`).toBeTruthy()
        expect(inst.rankerVersion, `rankerVersion null on ${inst.id}`).toBeTruthy()
        expect(inst.semanticIntentSnapshot, `semanticIntentSnapshot null on ${inst.id}`).toBeTruthy()
      }

      const instanceIds = instances.map((r) => r.id)
      const allItems = await db
        .select({
          shelfInstanceId: shelfInstanceItems.shelfInstanceId,
          mediaId: shelfInstanceItems.mediaId,
          finalScore: shelfInstanceItems.finalScore,
        })
        .from(shelfInstanceItems)
        .where(inArray(shelfInstanceItems.shelfInstanceId, instanceIds))

      // No two shelves should produce identical top-5 item lists.
      const itemsByShelf = new Map<string, string[]>()
      for (const item of allItems) {
        const list = itemsByShelf.get(item.shelfInstanceId) ?? []
        list.push(item.mediaId)
        itemsByShelf.set(item.shelfInstanceId, list)
      }

      const shelfMediaLists = [...itemsByShelf.values()]
      for (let i = 0; i < shelfMediaLists.length; i++) {
        for (let j = i + 1; j < shelfMediaLists.length; j++) {
          const sim = jaccard(shelfMediaLists[i].slice(0, 5), shelfMediaLists[j].slice(0, 5))
          expect(
            sim,
            `shelves ${i} and ${j} top-5 items too similar (Jaccard=${sim.toFixed(2)}, must be < 0.3) — semantics not driving retrieval`,
          ).toBeLessThan(0.3)
        }
      }
    },
    60_000,
  )
})
