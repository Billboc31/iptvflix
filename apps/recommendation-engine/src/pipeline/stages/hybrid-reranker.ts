import { eq, inArray, and } from 'drizzle-orm'
import { db } from '../../db/client.js'
import {
  movies,
  series,
  movieGenres,
  seriesGenres,
  genres,
  movieAvailabilities,
  seriesAvailabilities,
  mediaCredits,
  viewingProgress,
  profileTaste,
} from '../../db/schema.js'
import type { StageResult, CandidateItem, PipelineContext } from '../types.js'
import type { RecommendationQueryPlan } from '@iptvflix/api-contracts'

export const SCORE_MODEL_V1 = {
  version: 'v1',
  wSemantic: 0.35,
  wGenre: 0.25,
  wTheme: 0.15,
  wPeople: 0.10,
  wFreshness: 0.05,
  wPrior: 0.10,
  wAvailability: 0.05,
} as const

type ExplorationLevel = 'exploit' | 'explore' | 'discover'

interface WeightSet {
  wSemantic: number
  wGenre: number
  wTheme: number
  wPeople: number
  wFreshness: number
  wPrior: number
  wAvailability: number
}

function getBlendedWeights(model: typeof SCORE_MODEL_V1, level: ExplorationLevel): WeightSet {
  if (level === 'explore') {
    return {
      wSemantic: model.wSemantic * 1.3,
      wGenre: model.wGenre * 0.5,
      wTheme: model.wTheme * 0.5,
      wPeople: model.wPeople * 0.5,
      wFreshness: model.wFreshness,
      wPrior: model.wPrior * 1.5,
      wAvailability: model.wAvailability,
    }
  }
  if (level === 'discover') {
    return {
      wSemantic: 0.64,
      wGenre: 0.02,
      wTheme: 0.02,
      wPeople: 0.02,
      wFreshness: model.wFreshness,
      wPrior: model.wPrior * 2,
      wAvailability: model.wAvailability,
    }
  }
  return { ...model }
}

interface EnrichedCandidate extends CandidateItem {
  genreIds: string[]
  genreNames: string[]
  available: boolean
  collectionId: string | null
  directors: string[]
  keywords: string[]
  durationMinutes: number | null
  originalLanguage: string | null
  popularity: number | null
  voteAverage: number | null
  completionRatio: number | null
}

interface TasteSignals {
  genreScores: Record<string, number>
  positiveMediaIds: ReadonlySet<string>
  negativeMediaIds: ReadonlySet<string>
  signalCount: number
}

async function loadTasteSignals(profileId: string): Promise<TasteSignals | null> {
  const [row] = await db
    .select({
      genreScores: profileTaste.genreScores,
      positiveMediaIds: profileTaste.positiveMediaIds,
      negativeMediaIds: profileTaste.negativeMediaIds,
      signalCount: profileTaste.signalCount,
    })
    .from(profileTaste)
    .where(eq(profileTaste.profileId, profileId))

  if (!row) return null

  return {
    genreScores: (row.genreScores ?? {}) as Record<string, number>,
    positiveMediaIds: new Set<string>(row.positiveMediaIds ?? []),
    negativeMediaIds: new Set<string>(row.negativeMediaIds ?? []),
    signalCount: row.signalCount ?? 0,
  }
}

async function enrichCandidates(
  candidates: CandidateItem[],
  profileId?: string,
): Promise<EnrichedCandidate[]> {
  if (candidates.length === 0) return []

  const movieIds = candidates.filter((c) => c.mediaType === 'movie').map((c) => c.id)
  const seriesIds = candidates.filter((c) => c.mediaType === 'series').map((c) => c.id)
  const allIds = [...movieIds, ...seriesIds]

  const [
    movieGenreRows,
    seriesGenreRows,
    allGenreRows,
    availMovieRows,
    availSeriesRows,
    movieMetaRows,
    seriesMetaRows,
    directorRows,
    progressRows,
  ] = await Promise.all([
    movieIds.length > 0
      ? db.select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId })
          .from(movieGenres)
          .where(inArray(movieGenres.movieId, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId })
          .from(seriesGenres)
          .where(inArray(seriesGenres.seriesId, seriesIds))
      : Promise.resolve([]),
    db.select({ id: genres.id, name: genres.name }).from(genres),
    movieIds.length > 0
      ? db.select({ movieId: movieAvailabilities.movieId })
          .from(movieAvailabilities)
          .where(and(inArray(movieAvailabilities.movieId, movieIds), eq(movieAvailabilities.status, 'AVAILABLE')))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ seriesId: seriesAvailabilities.seriesId })
          .from(seriesAvailabilities)
          .where(and(inArray(seriesAvailabilities.seriesId, seriesIds), eq(seriesAvailabilities.status, 'AVAILABLE')))
      : Promise.resolve([]),
    movieIds.length > 0
      ? db.select({ id: movies.id, durationMinutes: movies.durationMinutes, originalLanguage: movies.originalLanguage, collectionId: movies.collectionId, popularity: movies.popularity, voteAverage: movies.voteAverage, keywords: movies.keywords })
          .from(movies)
          .where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ id: series.id, originalLanguage: series.originalLanguage, popularity: series.popularity, voteAverage: series.voteAverage, keywords: series.keywords })
          .from(series)
          .where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    allIds.length > 0
      ? db.select({ mediaId: mediaCredits.mediaId, name: mediaCredits.name })
          .from(mediaCredits)
          .where(and(inArray(mediaCredits.mediaId, allIds), eq(mediaCredits.role, 'director')))
      : Promise.resolve([]),
    profileId && movieIds.length > 0
      ? db.select({ mediaId: viewingProgress.mediaId, progressSeconds: viewingProgress.progressSeconds, durationSeconds: viewingProgress.durationSeconds })
          .from(viewingProgress)
          .where(and(eq(viewingProgress.profileId, profileId), eq(viewingProgress.mediaType, 'MOVIE'), inArray(viewingProgress.mediaId, movieIds)))
      : Promise.resolve([]),
  ])

  const genreNameMap = new Map(allGenreRows.map((g) => [g.id, g.name]))

  const movieGenreMap = new Map<string, string[]>()
  for (const { movieId, genreId } of movieGenreRows) {
    const list = movieGenreMap.get(movieId) ?? []
    list.push(genreId)
    movieGenreMap.set(movieId, list)
  }

  const seriesGenreMap = new Map<string, string[]>()
  for (const { seriesId, genreId } of seriesGenreRows) {
    const list = seriesGenreMap.get(seriesId) ?? []
    list.push(genreId)
    seriesGenreMap.set(seriesId, list)
  }

  const availMovieSet = new Set(availMovieRows.map((r) => r.movieId))
  const availSeriesSet = new Set(availSeriesRows.map((r) => r.seriesId))
  const movieMetaMap = new Map(movieMetaRows.map((m) => [m.id, m]))
  const seriesMetaMap = new Map(seriesMetaRows.map((s) => [s.id, s]))

  const directorMap = new Map<string, string[]>()
  for (const { mediaId, name } of directorRows) {
    const list = directorMap.get(mediaId) ?? []
    list.push(name)
    directorMap.set(mediaId, list)
  }

  const completionRatioMap = new Map<string, number>()
  for (const { mediaId, progressSeconds, durationSeconds } of progressRows) {
    if (durationSeconds > 0) completionRatioMap.set(mediaId, progressSeconds / durationSeconds)
  }

  return candidates.map((c) => {
    const genreIds =
      c.mediaType === 'movie' ? (movieGenreMap.get(c.id) ?? []) : (seriesGenreMap.get(c.id) ?? [])
    const genreNames = genreIds.map((id) => genreNameMap.get(id) ?? '').filter(Boolean)
    const available = c.mediaType === 'movie' ? availMovieSet.has(c.id) : availSeriesSet.has(c.id)
    const movieMeta = c.mediaType === 'movie' ? (movieMetaMap.get(c.id) ?? null) : null
    const seriesMeta = c.mediaType === 'series' ? (seriesMetaMap.get(c.id) ?? null) : null

    return {
      ...c,
      genreIds,
      genreNames,
      available,
      collectionId: movieMeta?.collectionId ?? null,
      directors: directorMap.get(c.id) ?? [],
      keywords: (movieMeta?.keywords ?? seriesMeta?.keywords ?? []) as string[],
      durationMinutes: movieMeta?.durationMinutes ?? null,
      originalLanguage: movieMeta?.originalLanguage ?? seriesMeta?.originalLanguage ?? null,
      popularity: movieMeta?.popularity ?? seriesMeta?.popularity ?? null,
      voteAverage: movieMeta?.voteAverage ?? seriesMeta?.voteAverage ?? null,
      completionRatio: completionRatioMap.get(c.id) ?? null,
    }
  })
}

function normalizeGenreAffinity(genreIds: string[], genreScores: Record<string, number>): number {
  if (genreIds.length === 0) return 0
  const allPositive = Object.values(genreScores).filter((s) => s > 0)
  const maxScore = allPositive.length > 0 ? Math.max(...allPositive) : 1
  const total = genreIds.reduce((sum, gId) => sum + Math.max(0, (genreScores[gId] ?? 0)) / maxScore, 0)
  return Math.min(1.0, total / genreIds.length)
}

function computeThemeAffinity(c: EnrichedCandidate, desiredThemes: string[], desiredTone: string[]): number {
  const signals = [...desiredThemes, ...desiredTone]
  if (signals.length === 0) return 0.5
  const signalSet = signals.map((s) => s.toLowerCase())
  const candidateTerms = [
    ...c.keywords.map((k) => k.toLowerCase()),
    ...c.genreNames.map((g) => g.toLowerCase()),
  ]
  if (candidateTerms.length === 0) return 0.5
  const matches = signalSet.filter((signal) =>
    candidateTerms.some((term) => term.includes(signal) || signal.includes(term)),
  )
  return Math.min(1.0, matches.length / signals.length)
}

function computePeopleAffinity(c: EnrichedCandidate, preferredDirectors?: string[]): number {
  if (!preferredDirectors || preferredDirectors.length === 0 || c.directors.length === 0) return 0.5
  const prefSet = new Set(preferredDirectors.map((d) => d.toLowerCase()))
  const matched = c.directors.some((d) => prefSet.has(d.toLowerCase()))
  return matched ? 1.0 : 0.5
}

function computeFreshness(year: number | null | undefined): number {
  if (year == null) return 0.5
  const currentYear = new Date().getFullYear()
  return Math.max(0, Math.min(1.0, 1 - (currentYear - year) / 20))
}

function computeQualityPrior(popularity: number | null, voteAverage: number | null): number {
  const normPop = popularity != null ? Math.min(1.0, popularity / 100) : 0.3
  const normVote = voteAverage != null ? voteAverage / 10 : 0.5
  return normPop * 0.4 + normVote * 0.6
}

function computeAvoidPenalty(c: EnrichedCandidate, avoidSignals: string[]): number {
  if (avoidSignals.length === 0) return 0
  const avoidLower = avoidSignals.map((s) => s.toLowerCase())
  const terms = [
    ...c.keywords.map((k) => k.toLowerCase()),
    ...c.genreNames.map((g) => g.toLowerCase()),
  ]
  const hasMatch = avoidLower.some((signal) =>
    terms.some((term) => term.includes(signal) || signal.includes(term)),
  )
  return hasMatch ? 0.2 : 0
}

function passesHardFilters(c: EnrichedCandidate, queryPlan: RecommendationQueryPlan): boolean {
  const { hardFilters, mediaTypes } = queryPlan
  const candidateMediaType = c.mediaType.toUpperCase() as 'MOVIE' | 'SERIES'

  if (mediaTypes.length > 0 && mediaTypes.length < 2 && !mediaTypes.includes(candidateMediaType)) return false
  if (hardFilters.maxRuntimeMinutes != null && c.durationMinutes != null && c.durationMinutes > hardFilters.maxRuntimeMinutes) return false
  if (hardFilters.minReleaseYear != null && c.year != null && c.year < hardFilters.minReleaseYear) return false
  if (hardFilters.maxReleaseYear != null && c.year != null && c.year > hardFilters.maxReleaseYear) return false

  if (hardFilters.includeGenres && hardFilters.includeGenres.length > 0) {
    const genreSet = new Set(c.genreIds)
    if (!hardFilters.includeGenres.some((g) => genreSet.has(g))) return false
  }

  if (hardFilters.excludeGenres && hardFilters.excludeGenres.length > 0) {
    const genreSet = new Set(c.genreIds)
    if (hardFilters.excludeGenres.some((g) => genreSet.has(g))) return false
  }

  if (hardFilters.audioLanguages && hardFilters.audioLanguages.length > 0 && c.originalLanguage != null) {
    if (!hardFilters.audioLanguages.includes(c.originalLanguage)) return false
  }

  return true
}

function applyDiversityFilter(
  scored: (EnrichedCandidate & { score: number; reasons: string[] })[],
  limit: number,
  maxPerCollection: number,
  maxPerDirector: number,
): typeof scored {
  const collCount = new Map<string, number>()
  const dirCount = new Map<string, number>()
  const result: typeof scored = []
  const deferred: typeof scored = []

  for (const c of scored) {
    if (result.length >= limit) { deferred.push(c); continue }
    const collId = c.collectionId
    const dir = c.directors[0] ?? null
    const collOk = !collId || (collCount.get(collId) ?? 0) < maxPerCollection
    const dirOk = !dir || (dirCount.get(dir) ?? 0) < maxPerDirector

    if (collOk && dirOk) {
      result.push(c)
      if (collId) collCount.set(collId, (collCount.get(collId) ?? 0) + 1)
      if (dir) dirCount.set(dir, (dirCount.get(dir) ?? 0) + 1)
    } else {
      deferred.push(c)
    }
  }

  const remaining = limit - result.length
  if (remaining > 0) result.push(...deferred.slice(0, remaining))
  return result
}

function buildReasons(
  semantic: number,
  genreAffinity: number,
  themeAffinity: number,
  genreNames: string[],
): string[] {
  const reasons: string[] = []
  if (semantic > 0.7) reasons.push('strong semantic match')
  else if (semantic > 0.5) reasons.push('semantic match')
  if (genreAffinity > 0.6 && genreNames.length > 0) reasons.push(`strong ${genreNames[0].toLowerCase()} genre affinity`)
  else if (genreAffinity > 0.3 && genreNames.length > 0) reasons.push(`${genreNames[0].toLowerCase()} genre affinity`)
  if (themeAffinity > 0.7) reasons.push('strong theme match')
  else if (themeAffinity > 0.55) reasons.push('theme match')
  if (reasons.length === 0) reasons.push('discovery')
  return reasons
}

export async function runHybridReranker(
  ctx: PipelineContext,
  candidates: CandidateItem[],
): Promise<StageResult> {
  const start = Date.now()

  if (candidates.length === 0 || !ctx.queryPlan) {
    return {
      stage: 'hybrid-reranker',
      available: false,
      reason: candidates.length === 0 ? 'no candidates' : 'no query plan',
      durationMs: Date.now() - start,
      inputCount: candidates.length,
      outputCount: 0,
      candidates: [],
    }
  }

  const limit = ctx.request.limit ?? 24

  try {
    const [enriched, taste] = await Promise.all([
      enrichCandidates(candidates, ctx.request.profileId),
      ctx.request.profileId ? loadTasteSignals(ctx.request.profileId) : Promise.resolve(null),
    ])

    const plan = ctx.queryPlan
    const weights = getBlendedWeights(SCORE_MODEL_V1, 'exploit')
    const allGenreScores = taste?.genreScores ?? {}

    const eligible = enriched.filter((c) => passesHardFilters(c, plan))

    const scored = eligible.map((c) => {
      const isNegative = taste?.negativeMediaIds.has(c.id) ?? false
      const isCompleted = c.completionRatio != null && c.completionRatio >= 0.9
      const isAbandoned = c.completionRatio != null && c.completionRatio > 0 && c.completionRatio < 0.2

      const semantic = c.similarity ?? 0
      const genreAffinity = normalizeGenreAffinity(c.genreIds, allGenreScores)
      const themeAffinity = computeThemeAffinity(c, plan.desiredThemes, plan.desiredTone)
      const peopleAffinity = computePeopleAffinity(c, plan.softPreferences?.preferredDirectors)
      const fresh = computeFreshness(c.year)
      const prior = computeQualityPrior(c.popularity, c.voteAverage)
      const availBonus = c.available ? 1.0 : 0.0

      const watchedPenalty = isCompleted ? 0.3 : 0
      const abandonPenalty = isAbandoned ? 0.1 : 0
      const dislikePenalty = isNegative ? 1.5 : 0
      const avoidPenalty = computeAvoidPenalty(c, plan.avoidSignals)

      const weighted =
        semantic * weights.wSemantic +
        genreAffinity * weights.wGenre +
        themeAffinity * weights.wTheme +
        peopleAffinity * weights.wPeople +
        fresh * weights.wFreshness +
        prior * weights.wPrior +
        availBonus * weights.wAvailability

      const finalScore = weighted - watchedPenalty - abandonPenalty - dislikePenalty - avoidPenalty

      return {
        ...c,
        score: finalScore,
        reasons: buildReasons(semantic, genreAffinity, themeAffinity, c.genreNames),
      }
    })

    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.id.localeCompare(b.id)
    })

    const diversified = applyDiversityFilter(scored, limit, 2, 3)

    const output: CandidateItem[] = diversified.map((c) => ({
      id: c.id,
      mediaType: c.mediaType,
      title: c.title,
      year: c.year,
      posterPath: c.posterPath,
      score: c.score,
      reasons: c.reasons,
    }))

    ctx.log.info(
      { requestId: ctx.requestId, stage: 'hybrid-reranker', durationMs: Date.now() - start, inputCount: candidates.length, outputCount: output.length },
      'stage complete',
    )

    return {
      stage: 'hybrid-reranker',
      available: true,
      durationMs: Date.now() - start,
      inputCount: candidates.length,
      outputCount: output.length,
      candidates: output,
    }
  } catch (err) {
    ctx.log.error({ requestId: ctx.requestId, stage: 'hybrid-reranker', err }, 'stage error')
    return {
      stage: 'hybrid-reranker',
      available: false,
      reason: `reranker error: ${(err as Error).message}`,
      durationMs: Date.now() - start,
      inputCount: candidates.length,
      outputCount: 0,
      candidates: [],
    }
  }
}
