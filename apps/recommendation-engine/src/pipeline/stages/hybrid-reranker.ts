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
  profileMediaExposure,
} from '../../db/schema.js'
import type { StageResult, CandidateItem, PipelineContext } from '../types.js'
import type { RecommendationQueryPlan, ScoreBreakdown } from '@iptvflix/api-contracts'

export const SCORE_MODEL_V1 = {
  version: 'v1',
  wSemantic: 0.35,
  wGenre: 0.25,
  wTheme: 0.15,
  wPeople: 0.10,
  wKeyword: 0.0,
  wFranchise: 0.0,
  wLanguage: 0.0,
  wDecade: 0.0,
  wMediaType: 0.0,
  wFreshness: 0.05,
  wPrior: 0.10,
  wAvailability: 0.05,
} as const

export const SCORE_MODEL_V2 = {
  version: 'v2',
  wSemantic: 0.28,
  wGenre: 0.18,
  wTheme: 0.10,
  wPeople: 0.08,
  wKeyword: 0.10,
  wFranchise: 0.05,
  wLanguage: 0.05,
  wDecade: 0.04,
  wMediaType: 0.04,
  wFreshness: 0.03,
  wPrior: 0.10,
  wAvailability: 0.05,
} as const

type ExplorationLevel = 'exploit' | 'explore' | 'discover'

interface WeightSet {
  wSemantic: number
  wGenre: number
  wTheme: number
  wPeople: number
  wKeyword: number
  wFranchise: number
  wLanguage: number
  wDecade: number
  wMediaType: number
  wFreshness: number
  wPrior: number
  wAvailability: number
}

function getBlendedWeights(model: typeof SCORE_MODEL_V2, level: ExplorationLevel): WeightSet {
  const { version: _v, ...base } = model
  if (level === 'explore') {
    return {
      ...base,
      wSemantic: base.wSemantic * 1.3,
      wGenre: base.wGenre * 0.5,
      wTheme: base.wTheme * 0.5,
      wPeople: base.wPeople * 0.5,
      wKeyword: base.wKeyword * 0.5,
      wFranchise: base.wFranchise * 0.5,
      wLanguage: base.wLanguage * 0.5,
      wDecade: base.wDecade * 0.5,
      wMediaType: base.wMediaType * 0.5,
      wPrior: base.wPrior * 1.5,
    }
  }
  if (level === 'discover') {
    return {
      wSemantic: 0.64,
      wGenre: 0.02,
      wTheme: 0.02,
      wPeople: 0.01,
      wKeyword: 0.01,
      wFranchise: 0.01,
      wLanguage: 0.01,
      wDecade: 0.01,
      wMediaType: 0.01,
      wFreshness: base.wFreshness,
      wPrior: base.wPrior * 2,
      wAvailability: base.wAvailability,
    }
  }
  return { ...base }
}

interface EnrichedCandidate extends CandidateItem {
  genreIds: string[]
  genreNames: string[]
  available: boolean
  collectionId: string | null
  directors: string[]
  creditPersonIds: string[]
  keywords: string[]
  productionCountries: unknown[]
  durationMinutes: number | null
  originalLanguage: string | null
  popularity: number | null
  voteAverage: number | null
  completionRatio: number | null
  exposureCount: number
}

interface TasteSignals {
  genreScores: Record<string, number>
  positiveMediaIds: ReadonlySet<string>
  negativeMediaIds: ReadonlySet<string>
  dislikedMediaIds: ReadonlySet<string>
  notInterestedMediaIds: ReadonlySet<string>
  signalCount: number
  personScores: Record<string, number>
  keywordScores: Record<string, number>
  franchiseScores: Record<string, number>
  languageScores: Record<string, number>
  countryScores: Record<string, number>
  decadeScores: Record<string, number>
  mediaTypePreferences: Record<string, number>
}

async function loadTasteSignals(profileId: string): Promise<TasteSignals | null> {
  const [row] = await db
    .select({
      genreScores: profileTaste.genreScores,
      positiveMediaIds: profileTaste.positiveMediaIds,
      negativeMediaIds: profileTaste.negativeMediaIds,
      dislikedMediaIds: profileTaste.dislikedMediaIds,
      notInterestedMediaIds: profileTaste.notInterestedMediaIds,
      signalCount: profileTaste.signalCount,
      personScores: profileTaste.personScores,
      keywordScores: profileTaste.keywordScores,
      franchiseScores: profileTaste.franchiseScores,
      languageScores: profileTaste.languageScores,
      countryScores: profileTaste.countryScores,
      decadeScores: profileTaste.decadeScores,
      mediaTypePreferences: profileTaste.mediaTypePreferences,
    })
    .from(profileTaste)
    .where(eq(profileTaste.profileId, profileId))

  if (!row) return null

  return {
    genreScores: (row.genreScores ?? {}) as Record<string, number>,
    positiveMediaIds: new Set<string>(row.positiveMediaIds ?? []),
    negativeMediaIds: new Set<string>(row.negativeMediaIds ?? []),
    dislikedMediaIds: new Set<string>(row.dislikedMediaIds ?? []),
    notInterestedMediaIds: new Set<string>(row.notInterestedMediaIds ?? []),
    signalCount: row.signalCount ?? 0,
    personScores: (row.personScores ?? {}) as Record<string, number>,
    keywordScores: (row.keywordScores ?? {}) as Record<string, number>,
    franchiseScores: (row.franchiseScores ?? {}) as Record<string, number>,
    languageScores: (row.languageScores ?? {}) as Record<string, number>,
    countryScores: (row.countryScores ?? {}) as Record<string, number>,
    decadeScores: (row.decadeScores ?? {}) as Record<string, number>,
    mediaTypePreferences: (row.mediaTypePreferences ?? {}) as Record<string, number>,
  }
}

async function loadExposureCounts(profileId: string, mediaIds: string[]): Promise<Map<string, number>> {
  if (mediaIds.length === 0) return new Map()
  const rows = await db
    .select({
      mediaId: profileMediaExposure.mediaId,
      exposureCount: profileMediaExposure.exposureCount,
    })
    .from(profileMediaExposure)
    .where(
      and(
        eq(profileMediaExposure.profileId, profileId),
        inArray(profileMediaExposure.mediaId, mediaIds),
      ),
    )
  return new Map(rows.map((r) => [r.mediaId, r.exposureCount]))
}

async function enrichCandidates(
  candidates: CandidateItem[],
  profileId?: string,
  exposureCounts?: Map<string, number>,
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
    creditRows,
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
      ? db.select({
            id: movies.id,
            durationMinutes: movies.durationMinutes,
            originalLanguage: movies.originalLanguage,
            productionCountries: movies.productionCountries,
            collectionId: movies.collectionId,
            popularity: movies.popularity,
            voteAverage: movies.voteAverage,
            keywords: movies.keywords,
          })
          .from(movies)
          .where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({
            id: series.id,
            originalLanguage: series.originalLanguage,
            productionCountries: series.productionCountries,
            popularity: series.popularity,
            voteAverage: series.voteAverage,
            keywords: series.keywords,
          })
          .from(series)
          .where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    allIds.length > 0
      ? db.select({
            mediaId: mediaCredits.mediaId,
            personId: mediaCredits.personId,
            name: mediaCredits.name,
            role: mediaCredits.role,
          })
          .from(mediaCredits)
          .where(inArray(mediaCredits.mediaId, allIds))
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
  const creditPersonIdsMap = new Map<string, string[]>()
  for (const { mediaId, personId, name, role } of creditRows) {
    if (role === 'director') {
      const list = directorMap.get(mediaId) ?? []
      list.push(name)
      directorMap.set(mediaId, list)
    }
    if (personId) {
      const list = creditPersonIdsMap.get(mediaId) ?? []
      list.push(personId)
      creditPersonIdsMap.set(mediaId, list)
    }
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
      creditPersonIds: creditPersonIdsMap.get(c.id) ?? [],
      keywords: (movieMeta?.keywords ?? seriesMeta?.keywords ?? []) as string[],
      productionCountries: (movieMeta?.productionCountries ?? seriesMeta?.productionCountries ?? []) as unknown[],
      durationMinutes: movieMeta?.durationMinutes ?? null,
      originalLanguage: movieMeta?.originalLanguage ?? seriesMeta?.originalLanguage ?? null,
      popularity: movieMeta?.popularity ?? seriesMeta?.popularity ?? null,
      voteAverage: movieMeta?.voteAverage ?? seriesMeta?.voteAverage ?? null,
      completionRatio: completionRatioMap.get(c.id) ?? null,
      exposureCount: exposureCounts?.get(c.id) ?? 0,
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

const PEOPLE_CALIBRATION = 5

export function computePeopleAffinity(c: EnrichedCandidate, personScores: Record<string, number>): number {
  if (c.creditPersonIds.length === 0) return 0.5
  let bestScore = 0
  for (const id of c.creditPersonIds) {
    const s = personScores[id]
    if (s !== undefined && s > bestScore) bestScore = s
  }
  if (bestScore <= 0) return 0.5
  return Math.min(bestScore / PEOPLE_CALIBRATION, 1.0)
}

export function computeKeywordAffinity(c: EnrichedCandidate, keywordScores: Record<string, number>): number {
  if (c.keywords.length === 0) return 0.5
  const positiveKeys = new Set(Object.entries(keywordScores).filter(([, s]) => s > 0).map(([k]) => k))
  if (positiveKeys.size === 0) return 0.5
  const matches = c.keywords.filter((kw) => positiveKeys.has(kw)).length
  if (matches === 0) return 0.5
  return matches / Math.min(c.keywords.length, 5)
}

export function computeFranchiseAffinity(c: EnrichedCandidate, franchiseScores: Record<string, number>): number {
  if (!c.collectionId) return 0.5
  const score = franchiseScores[c.collectionId]
  if (score === undefined) return 0.5
  if (score <= 0) return 0.2
  const maxPositive = Math.max(...Object.values(franchiseScores).filter((s) => s > 0))
  return Math.min(score / maxPositive, 1.0)
}

function extractCountryCodes(productionCountries: unknown[]): string[] {
  const codes: string[] = []
  for (const c of productionCountries) {
    if (typeof c === 'string' && c.length > 0) codes.push(c)
    else if (c && typeof c === 'object' && 'iso3166_1' in c) {
      const code = (c as { iso3166_1?: unknown }).iso3166_1
      if (typeof code === 'string' && code.length > 0) codes.push(code)
    }
  }
  return codes
}

export function computeLanguageAffinity(
  c: EnrichedCandidate,
  languageScores: Record<string, number>,
  countryScores: Record<string, number>,
): number {
  let langPart = 0.5
  if (c.originalLanguage != null) {
    const score = languageScores[c.originalLanguage]
    if (score !== undefined) {
      if (score <= 0) {
        langPart = 0.2
      } else {
        const maxLang = Math.max(...Object.values(languageScores).filter((s) => s > 0))
        langPart = Math.min(score / maxLang, 1.0)
      }
    }
  }

  let countryPart = 0.5
  const codes = extractCountryCodes(c.productionCountries)
  if (codes.length > 0) {
    let bestCountry: number | undefined
    for (const code of codes) {
      const s = countryScores[code]
      if (s !== undefined && (bestCountry === undefined || s > bestCountry)) bestCountry = s
    }
    if (bestCountry !== undefined) {
      if (bestCountry <= 0) {
        countryPart = 0.2
      } else {
        const allPositiveCountry = Object.values(countryScores).filter((s) => s > 0)
        const maxCountry = allPositiveCountry.length > 0 ? Math.max(...allPositiveCountry) : 1
        countryPart = Math.min(bestCountry / maxCountry, 1.0)
      }
    }
  }

  return (langPart + countryPart) / 2
}

export function computeDecadeAffinity(c: EnrichedCandidate, decadeScores: Record<string, number>): number {
  if (c.year == null) return 0.5
  const decade = `${Math.floor(c.year / 10) * 10}s`
  const score = decadeScores[decade]
  if (score === undefined) return 0.5
  if (score < 0) return 0.3
  const maxPositive = Math.max(...Object.values(decadeScores).filter((s) => s > 0))
  return Math.min(score / maxPositive, 1.0)
}

export function computeMediaTypeAffinity(c: EnrichedCandidate, mediaTypePreferences: Record<string, number>): number {
  const movieScore = mediaTypePreferences['movie'] ?? 0
  const seriesScore = mediaTypePreferences['series'] ?? 0
  if (movieScore === 0 && seriesScore === 0) return 0.5
  const dominant = movieScore >= seriesScore ? 'movie' : 'series'
  return c.mediaType === dominant ? 1.0 : 0.3
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
  languageAffinity: number,
  decadeAffinity: number,
  genreNames: string[],
): string[] {
  const reasons: string[] = []
  if (semantic > 0.7) reasons.push('strong semantic match')
  else if (semantic > 0.5) reasons.push('semantic match')
  if (genreAffinity > 0.6 && genreNames.length > 0) reasons.push(`strong ${genreNames[0].toLowerCase()} genre affinity`)
  else if (genreAffinity > 0.3 && genreNames.length > 0) reasons.push(`${genreNames[0].toLowerCase()} genre affinity`)
  if (languageAffinity > 0.7) reasons.push('preferred language')
  if (decadeAffinity > 0.7) reasons.push('preferred era')
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
    const allIds = candidates.map((c) => c.id)
    const [exposureCounts, taste] = await Promise.all([
      ctx.request.profileId ? loadExposureCounts(ctx.request.profileId, allIds) : Promise.resolve(new Map<string, number>()),
      ctx.request.profileId ? loadTasteSignals(ctx.request.profileId) : Promise.resolve(null),
    ])
    const enriched = await enrichCandidates(candidates, ctx.request.profileId, exposureCounts)

    const plan = ctx.queryPlan
    const weights = getBlendedWeights(SCORE_MODEL_V2, 'exploit')
    const allGenreScores = taste?.genreScores ?? {}

    const eligible = enriched.filter((c) => passesHardFilters(c, plan))

    const scored = eligible.map((c) => {
      const isDisliked = taste?.dislikedMediaIds.has(c.id) ?? false
      const isNotInterested = taste?.notInterestedMediaIds.has(c.id) ?? false
      const isCompleted = c.completionRatio != null && c.completionRatio >= 0.9
      const isAbandoned = c.completionRatio != null && c.completionRatio > 0 && c.completionRatio < 0.2

      const semantic = c.similarity ?? 0
      const genreAffinity = normalizeGenreAffinity(c.genreIds, allGenreScores)
      const themeAffinity = computeThemeAffinity(c, plan.desiredThemes, plan.desiredTone)
      const peopleAffinity = computePeopleAffinity(c, taste?.personScores ?? {})
      const keywordAffinity = computeKeywordAffinity(c, taste?.keywordScores ?? {})
      const franchiseAffinity = computeFranchiseAffinity(c, taste?.franchiseScores ?? {})
      const languageAffinity = computeLanguageAffinity(c, taste?.languageScores ?? {}, taste?.countryScores ?? {})
      const decadeAffinity = computeDecadeAffinity(c, taste?.decadeScores ?? {})
      const mediaTypeAffinity = computeMediaTypeAffinity(c, taste?.mediaTypePreferences ?? {})
      const fresh = computeFreshness(c.year)
      const prior = computeQualityPrior(c.popularity, c.voteAverage)
      const availBonus = c.available ? 1.0 : 0.0

      const alreadyWatchedPenalty = isCompleted ? 0.3 : 0
      const abandonPenalty = isAbandoned ? 0.1 : 0
      const dislikedPenalty = isDisliked ? 2.0 : isNotInterested ? 1.2 : 0
      const avoidPenalty = computeAvoidPenalty(c, plan.avoidSignals)
      const repetitionPenalty = 0.05 * Math.min(c.exposureCount, 4)

      const weighted =
        semantic * weights.wSemantic +
        genreAffinity * weights.wGenre +
        themeAffinity * weights.wTheme +
        peopleAffinity * weights.wPeople +
        keywordAffinity * weights.wKeyword +
        franchiseAffinity * weights.wFranchise +
        languageAffinity * weights.wLanguage +
        decadeAffinity * weights.wDecade +
        mediaTypeAffinity * weights.wMediaType +
        fresh * weights.wFreshness +
        prior * weights.wPrior +
        availBonus * weights.wAvailability

      const finalScore = weighted - alreadyWatchedPenalty - abandonPenalty - dislikedPenalty - avoidPenalty - repetitionPenalty

      const breakdown: ScoreBreakdown = {
        modelVersion: SCORE_MODEL_V2.version,
        semantic,
        genreAffinity,
        themeAffinity,
        peopleAffinity,
        keywordAffinity,
        franchiseAffinity,
        languageAffinity,
        decadeAffinity,
        mediaTypeAffinity,
        qualityPrior: prior,
        freshness: fresh,
        availabilityBonus: availBonus,
        alreadyWatchedPenalty,
        abandonPenalty,
        dislikedPenalty,
        avoidPenalty,
        repetitionPenalty,
        final: finalScore,
        reasons: buildReasons(semantic, genreAffinity, languageAffinity, decadeAffinity, c.genreNames),
      }

      return {
        ...c,
        score: finalScore,
        reasons: breakdown.reasons,
        scoreBreakdown: breakdown,
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
      scoreBreakdown: c.scoreBreakdown,
      available: c.available,
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
