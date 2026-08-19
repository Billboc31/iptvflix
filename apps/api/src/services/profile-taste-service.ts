import { count, eq, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  profileTaste,
  explicitFeedback,
  viewingProgress,
  watchlist,
  episodes,
  movieGenres,
  seriesGenres,
  genres,
  movies,
  series,
  mediaCredits,
  profileInteractionEvents,
} from '../db/schema/index.js'
import type { ProfileTaste, GenreScore } from '@iptvflix/api-contracts'

export const SIGNAL_WEIGHTS = {
  LIKE: 3,
  DISLIKE: -3,
  NOT_INTERESTED: -2,
  COMPLETED_VIEW: 1,
  IN_PROGRESS_VIEW: 0.5,
  WATCHLIST: 0.5,
} as const

async function loadGenres(
  mediaType: 'MOVIE' | 'SERIES',
  mediaId: string,
): Promise<Array<{ id: string; slug: string; name: string }>> {
  if (mediaType === 'MOVIE') {
    return db
      .select({ id: genres.id, slug: genres.slug, name: genres.name })
      .from(movieGenres)
      .innerJoin(genres, eq(movieGenres.genreId, genres.id))
      .where(eq(movieGenres.movieId, mediaId))
  }
  return db
    .select({ id: genres.id, slug: genres.slug, name: genres.name })
    .from(seriesGenres)
    .innerJoin(genres, eq(seriesGenres.genreId, genres.id))
    .where(eq(seriesGenres.seriesId, mediaId))
}

function buildOutput(
  profileId: string,
  genreScoresMap: Record<string, number>,
  genreMetaMap: Record<string, { slug: string; name: string }>,
  positiveMediaIds: string[],
  negativeMediaIds: string[],
  signalCount: number,
  builtAt: Date,
  extra: {
    personScores: Record<string, number>
    personMeta: Record<string, { name: string; role: string }>
    keywordScores: Record<string, number>
    franchiseScores: Record<string, number>
    languageScores: Record<string, number>
    countryScores: Record<string, number>
    decadeScores: Record<string, number>
    mediaTypePreferences: Record<string, number>
    completionRate: number | null
    historyEventCount: number
    tasteVersion: number
    dislikedMediaIds: string[]
    notInterestedMediaIds: string[]
  },
): ProfileTaste {
  const genreScores: GenreScore[] = Object.entries(genreScoresMap)
    .filter(([, score]) => score !== 0)
    .map(([genreId, score]) => ({
      genreId,
      slug: genreMetaMap[genreId]?.slug ?? '',
      name: genreMetaMap[genreId]?.name ?? '',
      score,
    }))
    .sort((a, b) => b.score - a.score || a.genreId.localeCompare(b.genreId))

  return {
    profileId,
    genreScores,
    positiveMediaIds,
    negativeMediaIds,
    dislikedMediaIds: extra.dislikedMediaIds,
    notInterestedMediaIds: extra.notInterestedMediaIds,
    signalCount,
    builtAt: builtAt.toISOString(),
    personScores: extra.personScores,
    personMeta: extra.personMeta,
    keywordScores: extra.keywordScores,
    franchiseScores: extra.franchiseScores,
    languageScores: extra.languageScores,
    countryScores: extra.countryScores,
    decadeScores: extra.decadeScores,
    mediaTypePreferences: extra.mediaTypePreferences,
    completionRate: extra.completionRate,
    historyEventCount: extra.historyEventCount,
    tasteVersion: extra.tasteVersion,
  }
}

function decadeKey(year: number | null): string | null {
  if (!year) return null
  return `${Math.floor(year / 10) * 10}s`
}

function countryScoreKeys(countries: unknown): string[] {
  if (!Array.isArray(countries)) return []
  const keys: string[] = []
  for (const c of countries) {
    if (typeof c === 'string' && c.length > 0) {
      keys.push(c)
    } else if (c && typeof c === 'object' && 'iso3166_1' in c) {
      const code = (c as { iso3166_1?: unknown }).iso3166_1
      if (typeof code === 'string' && code.length > 0) keys.push(code)
    }
  }
  return keys
}

export async function buildTaste(profileId: string): Promise<ProfileTaste> {
  const now = new Date()

  const [feedbackRows, progressRows, watchlistRows] = await Promise.all([
    db.select().from(explicitFeedback).where(eq(explicitFeedback.profileId, profileId)),
    db.select().from(viewingProgress).where(eq(viewingProgress.profileId, profileId)),
    db.select().from(watchlist).where(eq(watchlist.profileId, profileId)),
  ])

  const genreScoresMap: Record<string, number> = {}
  const genreMetaMap: Record<string, { slug: string; name: string }> = {}
  const positiveSet = new Set<string>()
  const negativeSet = new Set<string>()
  const dislikedSet = new Set<string>()
  const notInterestedSet = new Set<string>()
  const personScores: Record<string, number> = {}
  const personMeta: Record<string, { name: string; role: string }> = {}
  const keywordScores: Record<string, number> = {}
  const franchiseScores: Record<string, number> = {}
  const languageScores: Record<string, number> = {}
  const countryScores: Record<string, number> = {}
  const decadeScores: Record<string, number> = {}
  const mediaTypeCounts: Record<string, number> = {}
  let signalCount = 0

  function accumulate(genreRows: Array<{ id: string; slug: string; name: string }>, weight: number): void {
    for (const g of genreRows) {
      genreScoresMap[g.id] = (genreScoresMap[g.id] ?? 0) + weight
      genreMetaMap[g.id] = { slug: g.slug, name: g.name }
    }
  }

  async function accumulateMediaFeatures(
    mediaType: 'MOVIE' | 'SERIES',
    mediaId: string,
    weight: number,
  ): Promise<void> {
    // genre
    accumulate(await loadGenres(mediaType, mediaId), weight)

    // media type preference
    mediaTypeCounts[mediaType] = (mediaTypeCounts[mediaType] ?? 0) + weight

    if (mediaType === 'MOVIE') {
      const [movie] = await db
        .select({
          keywords: movies.keywords,
          originalLanguage: movies.originalLanguage,
          productionCountries: movies.productionCountries,
          year: movies.year,
          collectionId: movies.collectionId,
        })
        .from(movies)
        .where(eq(movies.id, mediaId))
      if (movie) {
        // keywords
        if (Array.isArray(movie.keywords)) {
          for (const kw of movie.keywords as string[]) {
            keywordScores[kw] = (keywordScores[kw] ?? 0) + weight
          }
        }
        // language
        if (movie.originalLanguage) {
          languageScores[movie.originalLanguage] = (languageScores[movie.originalLanguage] ?? 0) + weight
        }
        // countries
        for (const c of countryScoreKeys(movie.productionCountries)) {
          countryScores[c] = (countryScores[c] ?? 0) + weight
        }
        // decade
        const dk = decadeKey(movie.year)
        if (dk) decadeScores[dk] = (decadeScores[dk] ?? 0) + weight
        // franchise
        if (movie.collectionId) {
          franchiseScores[movie.collectionId] = (franchiseScores[movie.collectionId] ?? 0) + weight
        }
      }
    } else {
      const [s] = await db
        .select({
          keywords: series.keywords,
          originalLanguage: series.originalLanguage,
          productionCountries: series.productionCountries,
          firstAirYear: series.firstAirYear,
        })
        .from(series)
        .where(eq(series.id, mediaId))
      if (s) {
        if (Array.isArray(s.keywords)) {
          for (const kw of s.keywords as string[]) {
            keywordScores[kw] = (keywordScores[kw] ?? 0) + weight
          }
        }
        if (s.originalLanguage) {
          languageScores[s.originalLanguage] = (languageScores[s.originalLanguage] ?? 0) + weight
        }
        for (const c of countryScoreKeys(s.productionCountries)) {
          countryScores[c] = (countryScores[c] ?? 0) + weight
        }
        const dk = decadeKey(s.firstAirYear)
        if (dk) decadeScores[dk] = (decadeScores[dk] ?? 0) + weight
      }
    }

    // credits — persons
    const credits = await db
      .select({
        personId: mediaCredits.personId,
        name: mediaCredits.name,
        role: mediaCredits.role,
      })
      .from(mediaCredits)
      .where(eq(mediaCredits.mediaId, mediaId))
    for (const c of credits) {
      if (!c.personId) continue
      personScores[c.personId] = (personScores[c.personId] ?? 0) + weight
      personMeta[c.personId] = { name: c.name, role: c.role }
    }
  }

  for (const fb of feedbackRows) {
    const weight = SIGNAL_WEIGHTS[fb.feedback as keyof typeof SIGNAL_WEIGHTS]
    const mediaType = fb.mediaType as 'MOVIE' | 'SERIES'
    await accumulateMediaFeatures(mediaType, fb.mediaId, weight)
    if (fb.feedback === 'LIKE') {
      positiveSet.add(fb.mediaId)
    } else if (fb.feedback === 'DISLIKE') {
      negativeSet.add(fb.mediaId)
      dislikedSet.add(fb.mediaId)
    } else {
      negativeSet.add(fb.mediaId)
      notInterestedSet.add(fb.mediaId)
    }
    signalCount++
  }

  for (const vp of progressRows) {
    if (vp.durationSeconds <= 0) continue
    const ratio = vp.progressSeconds / vp.durationSeconds
    if (ratio < 0.05) continue

    const weight = ratio >= 0.9 ? SIGNAL_WEIGHTS.COMPLETED_VIEW : SIGNAL_WEIGHTS.IN_PROGRESS_VIEW
    const isCompleted = ratio >= 0.9

    let resolvedType: 'MOVIE' | 'SERIES'
    let resolvedId: string

    if (vp.mediaType === 'MOVIE') {
      resolvedType = 'MOVIE'
      resolvedId = vp.mediaId
    } else {
      const [ep] = await db
        .select({ seriesId: episodes.seriesId })
        .from(episodes)
        .where(eq(episodes.id, vp.mediaId))
      if (!ep) continue
      resolvedType = 'SERIES'
      resolvedId = ep.seriesId
    }

    await accumulateMediaFeatures(resolvedType, resolvedId, weight)
    if (isCompleted) positiveSet.add(resolvedId)
    signalCount++
  }

  for (const wl of watchlistRows) {
    const mediaType = wl.mediaType as 'MOVIE' | 'SERIES'
    await accumulateMediaFeatures(mediaType, wl.mediaId, SIGNAL_WEIGHTS.WATCHLIST)
    signalCount++
  }

  // compute completionRate from event history
  const [[startedRow], [completedRow], [eventCountRow]] = await Promise.all([
    db
      .select({ c: count() })
      .from(profileInteractionEvents)
      .where(
        sql`${profileInteractionEvents.profileId} = ${profileId} AND ${profileInteractionEvents.eventType} = 'PLAY_STARTED'`,
      ),
    db
      .select({ c: count() })
      .from(profileInteractionEvents)
      .where(
        sql`${profileInteractionEvents.profileId} = ${profileId} AND ${profileInteractionEvents.eventType} = 'PLAY_COMPLETED'`,
      ),
    db
      .select({ c: count() })
      .from(profileInteractionEvents)
      .where(eq(profileInteractionEvents.profileId, profileId)),
  ])
  const startedCount = Number(startedRow?.c ?? 0)
  const completedCount = Number(completedRow?.c ?? 0)
  const historyEventCount = Number(eventCountRow?.c ?? 0)
  const completionRate = startedCount > 0 ? completedCount / startedCount : null

  const mediaTypePreferences: Record<string, number> = {}
  for (const [mt, w] of Object.entries(mediaTypeCounts)) {
    mediaTypePreferences[mt.toLowerCase()] = w
  }

  const sortedPositive = [...positiveSet].sort()
  const sortedNegative = [...negativeSet].sort()
  const sortedDisliked = [...dislikedSet].sort()
  const sortedNotInterested = [...notInterestedSet].sort()

  const [upserted] = await db
    .insert(profileTaste)
    .values({
      profileId,
      genreScores: genreScoresMap,
      genreMeta: genreMetaMap,
      positiveMediaIds: sortedPositive,
      negativeMediaIds: sortedNegative,
      dislikedMediaIds: sortedDisliked,
      notInterestedMediaIds: sortedNotInterested,
      signalCount,
      builtAt: now,
      personScores,
      personMeta,
      keywordScores,
      franchiseScores,
      languageScores,
      countryScores,
      decadeScores,
      mediaTypePreferences,
      completionRate: completionRate !== null ? String(completionRate) : null,
      historyEventCount,
      tasteVersion: 1,
    })
    .onConflictDoUpdate({
      target: profileTaste.profileId,
      set: {
        genreScores: genreScoresMap,
        genreMeta: genreMetaMap,
        positiveMediaIds: sortedPositive,
        negativeMediaIds: sortedNegative,
        dislikedMediaIds: sortedDisliked,
        notInterestedMediaIds: sortedNotInterested,
        signalCount,
        builtAt: now,
        personScores,
        personMeta,
        keywordScores,
        franchiseScores,
        languageScores,
        countryScores,
        decadeScores,
        mediaTypePreferences,
        completionRate: completionRate !== null ? String(completionRate) : null,
        historyEventCount,
        tasteVersion: sql`${profileTaste.tasteVersion} + 1`,
      },
    })
    .returning({ tasteVersion: profileTaste.tasteVersion })

  return buildOutput(profileId, genreScoresMap, genreMetaMap, sortedPositive, sortedNegative, signalCount, now, {
    personScores,
    personMeta,
    keywordScores,
    franchiseScores,
    languageScores,
    countryScores,
    decadeScores,
    mediaTypePreferences,
    completionRate,
    historyEventCount,
    tasteVersion: upserted?.tasteVersion ?? 1,
    dislikedMediaIds: sortedDisliked,
    notInterestedMediaIds: sortedNotInterested,
  })
}

export async function getTaste(profileId: string): Promise<ProfileTaste> {
  const [row] = await db
    .select()
    .from(profileTaste)
    .where(eq(profileTaste.profileId, profileId))

  if (!row) {
    return buildTaste(profileId)
  }

  return buildOutput(
    profileId,
    row.genreScores as Record<string, number>,
    row.genreMeta as Record<string, { slug: string; name: string }>,
    row.positiveMediaIds,
    row.negativeMediaIds,
    row.signalCount,
    row.builtAt,
    {
      personScores: (row.personScores as Record<string, number>) ?? {},
      personMeta: (row.personMeta as Record<string, { name: string; role: string }>) ?? {},
      keywordScores: (row.keywordScores as Record<string, number>) ?? {},
      franchiseScores: (row.franchiseScores as Record<string, number>) ?? {},
      languageScores: (row.languageScores as Record<string, number>) ?? {},
      countryScores: (row.countryScores as Record<string, number>) ?? {},
      decadeScores: (row.decadeScores as Record<string, number>) ?? {},
      mediaTypePreferences: (row.mediaTypePreferences as Record<string, number>) ?? {},
      completionRate: row.completionRate ? Number(row.completionRate) : null,
      historyEventCount: row.historyEventCount,
      tasteVersion: row.tasteVersion,
      dislikedMediaIds: row.dislikedMediaIds ?? [],
      notInterestedMediaIds: row.notInterestedMediaIds ?? [],
    },
  )
}
