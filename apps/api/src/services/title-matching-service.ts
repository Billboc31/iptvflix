import { eq, and, ne } from 'drizzle-orm'
import { db } from '../db/client.js'
import { titleMatchResults } from '../db/schema/title-match-results.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import type { MetadataProvider, MetadataCandidate } from '../providers/metadata/types.js'
import { normalizeTitle } from '../matching/title-normalizer.js'
import {
  scoreCandidates,
  MATCH_THRESHOLD,
  AMBIGUITY_GAP,
  CANDIDATE_THRESHOLD,
} from '../matching/candidate-scorer.js'

export interface MatchItemInput {
  providerId: string
  providerItemId: string
  rawTitle: string
  mediaType: 'MOVIE' | 'SERIES'
  providerYear?: number | null
  providerTmdbId?: number | null
}

export interface MatchResult {
  id: string
  providerId: string
  providerItemId: string
  matchState: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS'
  confidence: number | null
  movieId: string | null
  seriesId: string | null
  normalizedTitle: string
  extractedYear: number | null
  candidateCount: number
  notes: string
}

type MatchRow = typeof titleMatchResults.$inferSelect

function toMatchResult(row: MatchRow): MatchResult {
  return {
    id: row.id,
    providerId: row.providerId,
    providerItemId: row.providerItemId,
    matchState: row.matchState,
    confidence: row.confidence !== null ? parseFloat(row.confidence) : null,
    movieId: row.movieId ?? null,
    seriesId: row.seriesId ?? null,
    normalizedTitle: row.normalizedTitle,
    extractedYear: row.extractedYear ?? null,
    candidateCount: row.candidateCount,
    notes: row.notes ?? '',
  }
}

/**
 * Find or create a canonical movies row for the given TMDB candidate.
 * When not found by tmdbId, inserts a skeleton with matchStatus='MATCHED'
 * so that enrichment picks it up on its next run.
 */
async function resolveMovieId(candidate: MetadataCandidate): Promise<string | null> {
  const tmdbId = parseInt(candidate.externalId, 10)
  if (isNaN(tmdbId)) return null

  const [existing] = await db.select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId))
  if (existing) return existing.id

  // Not in DB — insert canonical skeleton so enrichment can populate full metadata
  const [inserted] = await db
    .insert(movies)
    .values({
      title: candidate.title,
      year: candidate.year ?? null,
      tmdbId,
      matchStatus: 'MATCHED',
    })
    .onConflictDoNothing({ target: movies.tmdbId })
    .returning({ id: movies.id })

  if (inserted) return inserted.id

  // Concurrent insert — re-query
  const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId))
  return row?.id ?? null
}

/**
 * Find or create a canonical series row for the given TMDB candidate.
 */
async function resolveSeriesId(candidate: MetadataCandidate): Promise<string | null> {
  const tmdbId = parseInt(candidate.externalId, 10)
  if (isNaN(tmdbId)) return null

  const [existing] = await db.select({ id: series.id }).from(series).where(eq(series.tmdbId, tmdbId))
  if (existing) return existing.id

  const [inserted] = await db
    .insert(series)
    .values({
      title: candidate.title,
      firstAirYear: candidate.year ?? null,
      tmdbId,
      matchStatus: 'MATCHED',
    })
    .onConflictDoNothing({ target: series.tmdbId })
    .returning({ id: series.id })

  if (inserted) return inserted.id

  const [row] = await db.select({ id: series.id }).from(series).where(eq(series.tmdbId, tmdbId))
  return row?.id ?? null
}

export class TitleMatchingService {
  constructor(private readonly metadataProvider: MetadataProvider) {}

  async matchItem(input: MatchItemInput): Promise<MatchResult> {
    // Step 1: Guard — do not re-evaluate a confirmed match
    const [existing] = await db
      .select()
      .from(titleMatchResults)
      .where(
        and(
          eq(titleMatchResults.providerId, input.providerId),
          eq(titleMatchResults.providerItemId, input.providerItemId),
        ),
      )

    if (existing?.matchState === 'MATCHED') {
      return toMatchResult(existing)
    }

    // Step 2: Normalize
    const { normalizedTitle, extractedYear } = normalizeTitle(input.rawTitle)

    // Step 3: Effective year for metadata lookup
    const effectiveYear = extractedYear ?? input.providerYear ?? null

    // Step 4: Fetch candidates
    const candidates =
      input.mediaType === 'MOVIE'
        ? await this.metadataProvider.searchMovies(normalizedTitle, effectiveYear)
        : await this.metadataProvider.searchSeries(normalizedTitle, effectiveYear)

    // Step 5: Score
    const scored = scoreCandidates(
      {
        normalizedTitle,
        extractedYear,
        providerYear: input.providerYear,
        mediaType: input.mediaType,
      },
      candidates,
    )

    // Step 6: Determine match state
    const top = scored[0]
    const second = scored[1]
    const top1Raw = top ? top.rawScore : 0
    const top2Raw = second ? second.rawScore : 0
    const rawGap = top1Raw - top2Raw

    let matchState: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS'
    if (top && top.confidence >= MATCH_THRESHOLD && (scored.length === 1 || rawGap >= AMBIGUITY_GAP)) {
      matchState = 'MATCHED'
    } else if (top && top.confidence >= CANDIDATE_THRESHOLD) {
      matchState = 'AMBIGUOUS'
    } else {
      matchState = 'UNMATCHED'
    }

    // Step 7: Resolve canonical record (only for MATCHED; fall back to AMBIGUOUS if not found)
    let movieId: string | null = null
    let seriesId: string | null = null

    if (matchState === 'MATCHED' && top) {
      if (input.mediaType === 'MOVIE') {
        movieId = await resolveMovieId(top.candidate)
        if (movieId === null) matchState = 'AMBIGUOUS'
      } else {
        seriesId = await resolveSeriesId(top.candidate)
        if (seriesId === null) matchState = 'AMBIGUOUS'
      }
    }

    // Step 8: Build diagnostic notes (no credentials, no secrets)
    const top1Conf = top ? top.confidence.toFixed(4) : 'n/a'
    const top2Conf = second ? second.confidence.toFixed(4) : 'n/a'
    const yearInfo = `extracted=${extractedYear ?? 'none'},provider=${input.providerYear ?? 'none'}`
    let notes: string
    if (candidates.length === 0) {
      notes = `no candidates returned by metadata provider; year:${yearInfo}`
    } else {
      notes = `candidates:${candidates.length}, top-2:[${top1Conf},${top2Conf}], gap:${rawGap.toFixed(4)}, year:${yearInfo}, state:${matchState}`
    }

    // Step 9: Upsert with upgrade-only rule (never replace MATCHED with a lower state)
    const now = new Date()
    const row = {
      providerId: input.providerId,
      providerItemId: input.providerItemId,
      mediaType: input.mediaType,
      rawTitle: input.rawTitle,
      normalizedTitle,
      extractedYear,
      matchState,
      movieId,
      seriesId,
      confidence: top !== undefined ? String(top.confidence.toFixed(4)) : null,
      candidateCount: candidates.length,
      notes,
      matchedAt: matchState === 'MATCHED' ? now : null,
      updatedAt: now,
    }

    const [result] = await db
      .insert(titleMatchResults)
      .values({ ...row, createdAt: now })
      .onConflictDoUpdate({
        target: [titleMatchResults.providerId, titleMatchResults.providerItemId],
        set: row,
        where: ne(titleMatchResults.matchState, 'MATCHED'),
      })
      .returning()

    if (!result) {
      // WHERE clause prevented update — concurrent process already matched this item
      const [current] = await db
        .select()
        .from(titleMatchResults)
        .where(
          and(
            eq(titleMatchResults.providerId, input.providerId),
            eq(titleMatchResults.providerItemId, input.providerItemId),
          ),
        )
      return toMatchResult(current!)
    }

    return toMatchResult(result)
  }

  /**
   * Match a batch of items using a bounded-concurrency sliding window.
   * When opts is omitted, runs sequentially (preserves test isolation).
   * throttleMs introduces a delay between calls within each worker slot.
   */
  async matchBatch(
    inputs: MatchItemInput[],
    opts?: { concurrency?: number; throttleMs?: number },
  ): Promise<MatchResult[]> {
    if (inputs.length === 0) return []

    const limit = opts?.concurrency ?? 1
    const throttleMs = opts?.throttleMs ?? 0
    const results: MatchResult[] = new Array(inputs.length)
    const queue = inputs.map((input, i) => ({ input, i }))

    const worker = async (): Promise<void> => {
      while (queue.length > 0) {
        const item = queue.shift()!
        results[item.i] = await this.matchItem(item.input)
        if (throttleMs > 0 && queue.length > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, throttleMs))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(limit, inputs.length) }, worker))
    return results
  }
}
