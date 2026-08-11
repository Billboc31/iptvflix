import { eq, and, ne, sql } from 'drizzle-orm'
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

async function resolveMovieId(candidate: MetadataCandidate): Promise<string | null> {
  const tmdbId = parseInt(candidate.externalId, 10)
  if (!isNaN(tmdbId)) {
    const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.tmdbId, tmdbId))
    if (row) return row.id
  }
  // Title+year fallback
  const titleLower = candidate.title.toLocaleLowerCase('fr')
  const conditions = [sql`lower(${movies.title}) = ${titleLower}`]
  if (candidate.year !== null) conditions.push(eq(movies.year, candidate.year))
  const [row] = await db
    .select({ id: movies.id })
    .from(movies)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
  return row?.id ?? null
}

async function resolveSeriesId(candidate: MetadataCandidate): Promise<string | null> {
  const tmdbId = parseInt(candidate.externalId, 10)
  if (!isNaN(tmdbId)) {
    const [row] = await db.select({ id: series.id }).from(series).where(eq(series.tmdbId, tmdbId))
    if (row) return row.id
  }
  // Title+year fallback
  const titleLower = candidate.title.toLocaleLowerCase('fr')
  const conditions = [sql`lower(${series.title}) = ${titleLower}`]
  if (candidate.year !== null) conditions.push(eq(series.firstAirYear, candidate.year))
  const [row] = await db
    .select({ id: series.id })
    .from(series)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
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

  async matchBatch(inputs: MatchItemInput[]): Promise<MatchResult[]> {
    const results: MatchResult[] = []
    for (const input of inputs) {
      results.push(await this.matchItem(input))
    }
    return results
  }
}
