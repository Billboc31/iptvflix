// @deprecated — use recommendation-engine (apps/recommendation-engine/src/services/shelf-concept-generator.ts)
import OpenAI from 'openai'
import { eq, desc, and, gte, sql, inArray, or, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import {
  shelfConcepts,
  profileInteractionEvents,
  profiles,
  discoveryCandidate,
  movies,
  series as seriesTable,
} from '../db/schema/index.js'
import { getTaste } from './profile-taste-service.js'
import { ShelfFatigueService } from './shelf-fatigue-service.js'
import type { EmbeddingProvider } from './embedding-provider.js'
import type { SemanticRetrievalService } from './semantic-retrieval-service.js'
import { buildShelfConceptPrompt } from '../prompts/shelf-concept-generator-v1.js'
import type { ShelfConcept, ShelfConceptProfileContext } from '@iptvflix/api-contracts'
import {
  SHELF_CONCEPT_PERSONALIZED_RATIO,
  SHELF_CONCEPT_EXPLORATION_RATIO,
  SHELF_CONCEPT_DISCOVERY_RATIO,
  SHELF_CONCEPT_BATCH_SIZE,
  SHELF_CONCEPT_TTL_HOURS,
  SHELF_CONCEPT_MIN_POOL_SIZE,
  SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD,
} from '../config/env.js'

type Db = PostgresJsDatabase<typeof schema>

const PROMPT_VERSION = 'shelf-concept-v1'
const COLD_START_THRESHOLD = 3
const MAX_STRING_LEN = 100

const ALLOWED_GEN_TYPES = new Set<string>([
  'PERSONALIZED', 'EXPLORATION', 'DISCOVERY', 'FIXED', 'EDITORIAL',
])
const ALLOWED_FRESHNESS = new Set<string | null | undefined>([
  'AVAILABLE_NOW', 'NEW_RELEASES', 'ALL', null, undefined,
])
const ALLOWED_MEDIA_TYPES = new Set<string>(['MOVIE', 'SERIES'])

export type RawConcept = {
  title: string
  rawIntent: string
  semanticIntent: string
  generationType: string
  reasonCodes: unknown[]
  desiredMediaTypes: unknown[]
  freshnessPolicy: string | null | undefined
}

type ValidationResult = { valid: true } | { valid: false; reason: string }

function cap(s: unknown): string {
  return typeof s === 'string' ? s.slice(0, MAX_STRING_LEN) : ''
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function normalizeRatios(
  p: number,
  e: number,
  d: number,
): { personalized: number; exploration: number; discovery: number } {
  const sum = p + e + d
  if (sum <= 0) return { personalized: 0.7, exploration: 0.2, discovery: 0.1 }
  return { personalized: p / sum, exploration: e / sum, discovery: d / sum }
}

export class ShelfConceptGeneratorService {
  constructor(
    private readonly db: Db,
    private readonly openai: OpenAI | null,
    private readonly embeddingProvider: EmbeddingProvider | null,
    private readonly semanticRetrieval: SemanticRetrievalService | null,
    private readonly model: string,
  ) {}

  async buildProfileContext(profileId: string): Promise<ShelfConceptProfileContext> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const [taste, profileRows, interactionEvents, conceptRows, candidateRows] = await Promise.all([
      getTaste(profileId),
      this.db
        .select({
          isKids: profiles.isKids,
          preferredAudioLanguages: profiles.preferredAudioLanguages,
        })
        .from(profiles)
        .where(eq(profiles.id, profileId))
        .limit(1),
      this.db
        .select({
          mediaType: profileInteractionEvents.mediaType,
          mediaId: profileInteractionEvents.mediaId,
          eventType: profileInteractionEvents.eventType,
          occurredAt: profileInteractionEvents.occurredAt,
        })
        .from(profileInteractionEvents)
        .where(
          and(
            eq(profileInteractionEvents.profileId, profileId),
            gte(profileInteractionEvents.occurredAt, thirtyDaysAgo),
          ),
        )
        .orderBy(desc(profileInteractionEvents.occurredAt))
        .limit(300),
      this.db
        .select({
          title: shelfConcepts.title,
          generationType: shelfConcepts.generationType,
          reachCount: shelfConcepts.reachCount,
          openCount: shelfConcepts.openCount,
        })
        .from(shelfConcepts)
        .where(and(eq(shelfConcepts.profileId, profileId), eq(shelfConcepts.active, true)))
        .orderBy(desc(shelfConcepts.createdAt))
        .limit(10),
      this.db
        .select({ title: discoveryCandidate.title })
        .from(discoveryCandidate)
        .orderBy(desc(discoveryCandidate.createdAt))
        .limit(5),
    ])

    const profile = profileRows[0]
    const coldStart = taste.signalCount < COLD_START_THRESHOLD

    // Media type balance from interaction events
    const movieEvents = interactionEvents.filter((e) => e.mediaType === 'MOVIE').length
    const seriesEvents = interactionEvents.filter((e) => e.mediaType === 'SERIES').length
    const totalEvents = Math.max(movieEvents + seriesEvents, 1)
    const mediaTypeBalance = {
      movies: Math.round((movieEvents / totalEvents) * 100) / 100,
      series: Math.round((seriesEvents / totalEvents) * 100) / 100,
      anime: 0,
    }

    // Binge tendency: ≥3 series play events within a 24h window
    const seriesPlayEvents = interactionEvents.filter(
      (e) =>
        e.mediaType === 'SERIES' &&
        (e.eventType === 'PLAY_STARTED' || e.eventType === 'PLAY_COMPLETED'),
    )
    let bingeTendency = false
    for (let i = 0; i < seriesPlayEvents.length && !bingeTendency; i++) {
      const windowEnd = seriesPlayEvents[i].occurredAt.getTime()
      const windowStart = windowEnd - 24 * 60 * 60 * 1000
      const inWindow = seriesPlayEvents.filter(
        (e) => e.occurredAt.getTime() >= windowStart && e.occurredAt.getTime() <= windowEnd,
      ).length
      if (inWindow >= 3) bingeTendency = true
    }

    // Titles for recent completions / abandons
    const completionEvents = interactionEvents
      .filter((e) => e.eventType === 'PLAY_COMPLETED' && e.mediaId)
      .slice(0, 10)
    const abandonEvents = interactionEvents
      .filter((e) => e.eventType === 'PLAY_ABANDONED' && e.mediaId)
      .slice(0, 10)

    const completionMovieIds = completionEvents
      .filter((e) => e.mediaType === 'MOVIE')
      .map((e) => e.mediaId!)
    const completionSeriesIds = completionEvents
      .filter((e) => e.mediaType === 'SERIES')
      .map((e) => e.mediaId!)
    const abandonMovieIds = abandonEvents
      .filter((e) => e.mediaType === 'MOVIE')
      .map((e) => e.mediaId!)
    const abandonSeriesIds = abandonEvents
      .filter((e) => e.mediaType === 'SERIES')
      .map((e) => e.mediaId!)

    const [compMovies, compSeries, abanMovies, abanSeries] = await Promise.all([
      completionMovieIds.length > 0
        ? this.db.select({ title: movies.title }).from(movies).where(inArray(movies.id, completionMovieIds))
        : Promise.resolve<{ title: string }[]>([]),
      completionSeriesIds.length > 0
        ? this.db.select({ title: seriesTable.title }).from(seriesTable).where(inArray(seriesTable.id, completionSeriesIds))
        : Promise.resolve<{ title: string }[]>([]),
      abandonMovieIds.length > 0
        ? this.db.select({ title: movies.title }).from(movies).where(inArray(movies.id, abandonMovieIds))
        : Promise.resolve<{ title: string }[]>([]),
      abandonSeriesIds.length > 0
        ? this.db.select({ title: seriesTable.title }).from(seriesTable).where(inArray(seriesTable.id, abandonSeriesIds))
        : Promise.resolve<{ title: string }[]>([]),
    ])

    const recentCompletions = [
      ...compMovies.map((r) => cap(r.title)),
      ...compSeries.map((r) => cap(r.title)),
    ]
      .filter(Boolean)
      .slice(0, 5)

    const recentAbandons = [
      ...abanMovies.map((r) => cap(r.title)),
      ...abanSeries.map((r) => cap(r.title)),
    ]
      .filter(Boolean)
      .slice(0, 5)

    const recentShelfConcepts = conceptRows.map((c) => ({
      title: cap(c.title),
      generationType: c.generationType,
      openRate: Math.round((c.openCount / Math.max(c.reachCount, 1)) * 100) / 100,
    }))

    const newCatalogSignals = candidateRows.map((c) => cap(c.title)).filter(Boolean)
    const topGenres = taste.genreScores.slice(0, 5).filter((g) => g.score > 0).map((g) => cap(g.name))
    const topThemes = taste.genreScores.slice(0, 3).filter((g) => g.score > 0).map((g) => cap(g.slug))
    const languagePreferences = (profile?.preferredAudioLanguages ?? []).slice(0, 5)

    if (coldStart) {
      return {
        topGenres: [],
        topThemes: [],
        likedPeople: [],
        recentlyWatched: [],
        negativeSignals: [],
        mediaTypeBalance: { movies: 0.5, series: 0.5, anime: 0 },
        runtimePreference: 'mixed',
        languagePreferences,
        recentCompletions: [],
        recentAbandons: [],
        bingeTendency: false,
        recentShelfConcepts: [],
        newCatalogSignals,
        isKids: profile?.isKids ?? false,
        coldStart: true,
      }
    }

    return {
      topGenres,
      topThemes,
      likedPeople: [],
      recentlyWatched: taste.positiveMediaIds.slice(0, 5),
      negativeSignals: taste.negativeMediaIds.slice(0, 3),
      mediaTypeBalance,
      runtimePreference: 'mixed',
      languagePreferences,
      recentCompletions,
      recentAbandons,
      bingeTendency,
      recentShelfConcepts,
      newCatalogSignals,
      isKids: profile?.isKids ?? false,
      coldStart: false,
    }
  }

  validateConcept(concept: RawConcept, existingConcepts: ShelfConcept[]): ValidationResult {
    if (!concept.title || typeof concept.title !== 'string' || !concept.title.trim()) {
      return { valid: false, reason: 'empty title' }
    }
    if (!concept.rawIntent || typeof concept.rawIntent !== 'string' || !concept.rawIntent.trim()) {
      return { valid: false, reason: 'empty rawIntent' }
    }
    if (
      !concept.semanticIntent ||
      typeof concept.semanticIntent !== 'string' ||
      !concept.semanticIntent.trim()
    ) {
      return { valid: false, reason: 'empty semanticIntent' }
    }
    if (!ALLOWED_GEN_TYPES.has(concept.generationType)) {
      return { valid: false, reason: `invalid generationType: ${concept.generationType}` }
    }
    if (!Array.isArray(concept.reasonCodes)) {
      return { valid: false, reason: 'reasonCodes must be an array' }
    }
    if (
      !Array.isArray(concept.desiredMediaTypes) ||
      !concept.desiredMediaTypes.every((t) => ALLOWED_MEDIA_TYPES.has(t as string))
    ) {
      return { valid: false, reason: 'invalid desiredMediaTypes' }
    }
    if (
      concept.freshnessPolicy !== null &&
      concept.freshnessPolicy !== undefined &&
      !ALLOWED_FRESHNESS.has(concept.freshnessPolicy)
    ) {
      return { valid: false, reason: `invalid freshnessPolicy: ${concept.freshnessPolicy}` }
    }

    // Reject concepts too similar to persistently ignored ones (dismissCount > openCount * 2)
    const ignoredConcepts = existingConcepts.filter((c) => c.dismissCount > c.openCount * 2)
    const intentPrefix = concept.semanticIntent.toLowerCase().slice(0, 30)
    for (const ignored of ignoredConcepts) {
      if (ignored.semanticIntent.toLowerCase().includes(intentPrefix)) {
        return { valid: false, reason: `too similar to ignored concept: ${ignored.title}` }
      }
    }

    return { valid: true }
  }

  async generateConcepts(
    profileId: string,
    opts?: { count?: number },
  ): Promise<ShelfConcept[]> {
    if (!this.openai) {
      throw new Error('OPENAI_API_KEY not configured — cannot generate shelf concepts')
    }

    const count = opts?.count ?? SHELF_CONCEPT_BATCH_SIZE
    const profileContext = await this.buildProfileContext(profileId)

    const ratios = normalizeRatios(
      SHELF_CONCEPT_PERSONALIZED_RATIO,
      SHELF_CONCEPT_EXPLORATION_RATIO,
      SHELF_CONCEPT_DISCOVERY_RATIO,
    )

    const personalizedCount = Math.round(count * ratios.personalized)
    const explorationCount = Math.round(count * ratios.exploration)
    const discoveryCount = count - personalizedCount - explorationCount

    const counts = {
      personalized: personalizedCount,
      exploration: explorationCount,
      discovery: Math.max(0, discoveryCount),
    }

    const existingConcepts = await this.getActivePool(profileId)
    const messages = buildShelfConceptPrompt(profileContext, counts)

    const response = await this.openai.chat.completions.create({
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: Math.max(4000, count * 350),
      messages,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      console.warn('[ShelfConceptGeneratorService] empty response from LLM')
      return []
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(content)
    } catch {
      console.error(
        '[ShelfConceptGeneratorService] LLM response not valid JSON (possibly truncated — check max_tokens):',
        content.slice(0, 200),
      )
      return []
    }

    let rawConcepts: RawConcept[]
    if (
      parsed &&
      typeof parsed === 'object' &&
      'concepts' in (parsed as Record<string, unknown>) &&
      Array.isArray((parsed as Record<string, unknown>).concepts)
    ) {
      rawConcepts = (parsed as Record<string, unknown>).concepts as RawConcept[]
    } else if (Array.isArray(parsed)) {
      rawConcepts = parsed as RawConcept[]
    } else {
      console.warn('[ShelfConceptGeneratorService] unexpected LLM response shape')
      return []
    }

    const persisted: ShelfConcept[] = []
    const sessionEmbeddings: number[][] = []

    // Pre-load embeddings for existing DB pool concepts so dedup extends across batches (§4, §8)
    if (this.embeddingProvider && existingConcepts.length > 0) {
      const existingEmbeddings = await Promise.all(
        existingConcepts.map((c) =>
          this.embeddingProvider!.embed(c.semanticIntent.trim()).catch(() => null),
        ),
      )
      for (const emb of existingEmbeddings) {
        if (emb) sessionEmbeddings.push(emb)
      }
    }

    for (const raw of rawConcepts) {
      const validationResult = this.validateConcept(raw, existingConcepts)
      if (!validationResult.valid) {
        console.warn(
          `[ShelfConceptGeneratorService] concept rejected (${validationResult.reason}):`,
          raw.title,
        )
        continue
      }

      // Semantic dedup within this session
      if (this.embeddingProvider) {
        const embedding = await this.embeddingProvider.embed(raw.semanticIntent.trim())

        let maxSimilarity = 0
        for (const existing of sessionEmbeddings) {
          const sim = cosineSimilarity(embedding, existing)
          if (sim > maxSimilarity) maxSimilarity = sim
        }

        if (maxSimilarity > SHELF_CONCEPT_SEMANTIC_DEDUP_THRESHOLD) {
          console.warn(
            `[ShelfConceptGeneratorService] concept rejected (semantic dedup sim=${maxSimilarity.toFixed(3)}):`,
            raw.title,
          )
          continue
        }

        sessionEmbeddings.push(embedding)
      }

      // Dry-run retrieval — concept must produce ≥3 viable candidates
      if (this.semanticRetrieval) {
        const candidates = await this.semanticRetrieval.retrieve(raw.semanticIntent.trim(), 5)
        if (candidates.length < 3) {
          console.warn(
            `[ShelfConceptGeneratorService] concept rejected (dry-run ${candidates.length} candidates):`,
            raw.title,
          )
          continue
        }
      }

      const [inserted] = await this.db
        .insert(shelfConcepts)
        .values({
          profileId,
          title: String(raw.title).trim().slice(0, 200),
          rawIntent: String(raw.rawIntent).trim(),
          semanticIntent: String(raw.semanticIntent).trim(),
          generationType: raw.generationType as
            | 'PERSONALIZED'
            | 'EXPLORATION'
            | 'DISCOVERY'
            | 'FIXED'
            | 'EDITORIAL',
          reasonCodes: (Array.isArray(raw.reasonCodes) ? raw.reasonCodes : []) as string[],
          sourceModel: this.model,
          promptVersion: PROMPT_VERSION,
          desiredMediaTypes: (Array.isArray(raw.desiredMediaTypes)
            ? raw.desiredMediaTypes.filter((t) => ALLOWED_MEDIA_TYPES.has(t as string))
            : []) as ('MOVIE' | 'SERIES')[],
          freshnessPolicy: typeof raw.freshnessPolicy === 'string' ? raw.freshnessPolicy : null,
          active: true,
          expiresAt: new Date(Date.now() + SHELF_CONCEPT_TTL_HOURS * 60 * 60 * 1000),
        })
        .returning()

      if (inserted) {
        persisted.push(this.toApiModel(inserted))
      }
    }

    return persisted
  }

  async getActivePool(profileId: string): Promise<ShelfConcept[]> {
    const now = new Date()
    const rows = await this.db
      .select()
      .from(shelfConcepts)
      .where(
        and(
          eq(shelfConcepts.profileId, profileId),
          eq(shelfConcepts.active, true),
          or(isNull(shelfConcepts.expiresAt), gte(shelfConcepts.expiresAt, now)),
        ),
      )
      .orderBy(desc(shelfConcepts.createdAt))

    if (rows.length === 0) return []

    const conceptIds = rows.map((r) => r.id)
    const fatigueSvc = new ShelfFatigueService(this.db)
    const fatigueStates = await fatigueSvc.getFatigueStates(profileId, conceptIds)

    const active = rows.filter((r) => {
      const fatigue = fatigueStates.get(r.id)
      if (!fatigue?.cooldownUntil) return true
      return new Date(fatigue.cooldownUntil) <= now
    })

    return active.map((r) => this.toApiModel(r))
  }

  async needsRefresh(profileId: string): Promise<boolean> {
    const pool = await this.getActivePool(profileId)

    if (pool.length < SHELF_CONCEPT_MIN_POOL_SIZE) {
      return true
    }

    // Pool is ordered by createdAt desc — pool[0] is the newest
    const newest = pool[0]
    if (newest) {
      const ageMs = Date.now() - new Date(newest.createdAt).getTime()
      if (ageMs > SHELF_CONCEPT_TTL_HOURS * 60 * 60 * 1000) {
        return true
      }
    }

    // Refresh if taste was rebuilt after the newest concept
    try {
      const taste = await getTaste(profileId)
      if (newest && taste.builtAt > newest.createdAt) {
        return true
      }
    } catch {
      // Taste unavailable — don't force refresh
    }

    return false
  }

  async applyFeedback(conceptId: string, signal: 'good' | 'bad'): Promise<void> {
    if (signal === 'good') {
      await this.db
        .update(shelfConcepts)
        .set({ openCount: sql`${shelfConcepts.openCount} + 1` })
        .where(eq(shelfConcepts.id, conceptId))
    } else {
      await this.db
        .update(shelfConcepts)
        .set({ dismissCount: sql`${shelfConcepts.dismissCount} + 1` })
        .where(eq(shelfConcepts.id, conceptId))
    }
  }

  private toApiModel(row: typeof shelfConcepts.$inferSelect): ShelfConcept {
    return {
      id: row.id,
      profileId: row.profileId ?? null,
      title: row.title,
      rawIntent: row.rawIntent,
      semanticIntent: row.semanticIntent,
      generationType: row.generationType as ShelfConcept['generationType'],
      reasonCodes: (row.reasonCodes as string[]) ?? [],
      sourceModel: row.sourceModel,
      promptVersion: row.promptVersion,
      desiredMediaTypes: (row.desiredMediaTypes as ('MOVIE' | 'SERIES')[]) ?? [],
      freshnessPolicy: (row.freshnessPolicy as ShelfConcept['freshnessPolicy']) ?? null,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt?.toISOString() ?? null,
      reachCount: row.reachCount,
      openCount: row.openCount,
      playCount: row.playCount,
      completionCount: row.completionCount,
      dismissCount: row.dismissCount,
    }
  }
}
