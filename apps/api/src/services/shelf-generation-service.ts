import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelves,
  shelfMembers,
  movies,
  series,
  movieGenres,
  seriesGenres,
  discoveryCandidate,
} from '../db/schema/index.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js'
import { rankRecommendations } from './recommendation-ranking-service.js'
import type { GenerateShelfBody, GeneratedShelfRules, GenerateShelfResponse, SeedMediaRef } from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// materializeDiscoveryCandidate — private helper
// ---------------------------------------------------------------------------

async function materializeDiscoveryCandidate(
  candidateId: string,
  mediaType: 'MOVIE' | 'SERIES',
): Promise<string> {
  const [dc] = await db.select().from(discoveryCandidate).where(eq(discoveryCandidate.id, candidateId))
  if (!dc) {
    throw new ValidationError(`Discovery candidate not found: ${candidateId}`)
  }

  if (mediaType === 'MOVIE') {
    if (dc.canonicalMovieId) return dc.canonicalMovieId

    const [newMovie] = await db
      .insert(movies)
      .values({
        title: dc.title,
        year: dc.year,
        synopsis: dc.synopsis,
        posterPath: dc.posterPath,
        metadataProvider: dc.provenance,
      })
      .returning({ id: movies.id })

    await db
      .update(discoveryCandidate)
      .set({ canonicalMovieId: newMovie.id })
      .where(eq(discoveryCandidate.id, candidateId))

    return newMovie.id
  } else {
    if (dc.canonicalSeriesId) return dc.canonicalSeriesId

    const [newSeries] = await db
      .insert(series)
      .values({
        title: dc.title,
        firstAirYear: dc.year,
        synopsis: dc.synopsis,
        posterPath: dc.posterPath,
        metadataProvider: dc.provenance,
      })
      .returning({ id: series.id })

    await db
      .update(discoveryCandidate)
      .set({ canonicalSeriesId: newSeries.id })
      .where(eq(discoveryCandidate.id, candidateId))

    return newSeries.id
  }
}

// ---------------------------------------------------------------------------
// resolveGeneratedMembers — shared core logic for create and refresh
// ---------------------------------------------------------------------------

type ResolveResult = {
  members: { mediaType: 'MOVIE' | 'SERIES'; mediaId: string }[]
  inferredGenreIds: string[]
  seedTitles: string[]
}

async function resolveGeneratedMembers(
  profileId: string,
  seedMediaIds: SeedMediaRef[],
  opts: { mediaType?: 'MOVIE' | 'SERIES'; availableToMe?: boolean; limit: number },
): Promise<ResolveResult> {
  const seedMovieIds = seedMediaIds.filter((s) => s.mediaType === 'MOVIE').map((s) => s.mediaId)
  const seedSeriesIds = seedMediaIds.filter((s) => s.mediaType === 'SERIES').map((s) => s.mediaId)

  // Validate seeds exist and collect titles
  const seedTitles: string[] = []

  const [movieSeedRows, seriesSeedRows] = await Promise.all([
    seedMovieIds.length > 0
      ? db.select({ id: movies.id, title: movies.title }).from(movies).where(inArray(movies.id, seedMovieIds))
      : Promise.resolve([]),
    seedSeriesIds.length > 0
      ? db.select({ id: series.id, title: series.title }).from(series).where(inArray(series.id, seedSeriesIds))
      : Promise.resolve([]),
  ])

  const foundMovieIds = new Set(movieSeedRows.map((r) => r.id))
  const foundSeriesIds = new Set(seriesSeedRows.map((r) => r.id))

  for (const seed of seedMediaIds) {
    if (seed.mediaType === 'MOVIE') {
      if (!foundMovieIds.has(seed.mediaId)) {
        throw new ValidationError(`Seed media not found: ${seed.mediaId}`)
      }
      seedTitles.push(movieSeedRows.find((r) => r.id === seed.mediaId)!.title)
    } else {
      if (!foundSeriesIds.has(seed.mediaId)) {
        throw new ValidationError(`Seed media not found: ${seed.mediaId}`)
      }
      seedTitles.push(seriesSeedRows.find((r) => r.id === seed.mediaId)!.title)
    }
  }

  // Infer genre IDs from seed media
  const [movieGenreRows, seriesGenreRows] = await Promise.all([
    seedMovieIds.length > 0
      ? db.select({ genreId: movieGenres.genreId }).from(movieGenres).where(inArray(movieGenres.movieId, seedMovieIds))
      : Promise.resolve([]),
    seedSeriesIds.length > 0
      ? db
          .select({ genreId: seriesGenres.genreId })
          .from(seriesGenres)
          .where(inArray(seriesGenres.seriesId, seedSeriesIds))
      : Promise.resolve([]),
  ])

  const inferredGenreIdSet = new Set<string>()
  for (const r of movieGenreRows) inferredGenreIdSet.add(r.genreId)
  for (const r of seriesGenreRows) inferredGenreIdSet.add(r.genreId)
  const inferredGenreIds = [...inferredGenreIdSet]

  // Rank with inferred genre IDs as preference signal; fetch extra slots to account for seed filtering
  const recs = await rankRecommendations(profileId, {
    preferGenreIds: inferredGenreIds,
    mediaType: opts.mediaType,
    availableToMe: opts.availableToMe,
    includeSeen: false,
    limit: opts.limit + seedMediaIds.length,
  })

  // Filter out seed media IDs
  const seedIdSet = new Set(seedMediaIds.map((s) => s.mediaId))
  const candidates = recs.candidates.filter((c) => !seedIdSet.has(c.mediaId)).slice(0, opts.limit)

  // Materialize discovery candidates and build member list
  const members: { mediaType: 'MOVIE' | 'SERIES'; mediaId: string }[] = []
  for (const candidate of candidates) {
    if (candidate.source === 'DISCOVERY') {
      const canonicalId = await materializeDiscoveryCandidate(candidate.mediaId, candidate.mediaType)
      members.push({ mediaType: candidate.mediaType, mediaId: canonicalId })
    } else {
      members.push({ mediaType: candidate.mediaType, mediaId: candidate.mediaId })
    }
  }

  return { members, inferredGenreIds, seedTitles }
}

// ---------------------------------------------------------------------------
// generateShelfFromSeeds — public
// ---------------------------------------------------------------------------

export async function generateShelfFromSeeds(
  profileId: string,
  body: GenerateShelfBody,
): Promise<GenerateShelfResponse> {
  const { title, seedMediaIds, mediaType, availableToMe, limit: rawLimit } = body

  if (!Array.isArray(seedMediaIds) || seedMediaIds.length < 3 || seedMediaIds.length > 10) {
    throw new ValidationError('seedMediaIds must have between 3 and 10 entries')
  }

  const uniqueSeedIds = new Set(seedMediaIds.map((s) => s.mediaId))
  if (uniqueSeedIds.size !== seedMediaIds.length) {
    throw new ValidationError('seedMediaIds must not contain duplicate mediaId values')
  }

  const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100)

  const { members, inferredGenreIds, seedTitles } = await resolveGeneratedMembers(profileId, seedMediaIds, {
    mediaType,
    availableToMe,
    limit,
  })

  const generatedAt = new Date().toISOString()
  const rules: GeneratedShelfRules = {
    seedMediaIds,
    mediaType,
    availableToMe,
    limit,
    inferredGenreIds,
    generatedAt,
  }

  const shelf = await db.transaction(async (tx) => {
    const [{ maxPos }] = await tx
      .select({ maxPos: sql<number>`coalesce(max(${shelves.position}), -1)` })
      .from(shelves)
      .where(eq(shelves.profileId, profileId))

    const position = (maxPos ?? -1) + 1

    const [inserted] = await tx
      .insert(shelves)
      .values({ profileId, title, type: 'GENERATED', rules, position, layoutHint: 'ROW' })
      .returning()

    if (members.length > 0) {
      await tx
        .insert(shelfMembers)
        .values(members.map((m, idx) => ({ shelfId: inserted.id, mediaType: m.mediaType, mediaId: m.mediaId, position: idx })))
        .onConflictDoNothing()
    }

    return inserted
  })

  return {
    shelf: {
      id: shelf.id,
      title: shelf.title,
      type: 'GENERATED',
      layoutHint: shelf.layoutHint as 'ROW' | 'GRID',
      position: shelf.position,
    },
    explanation: { inferredGenreIds, seedTitles, generatedAt },
  }
}

// ---------------------------------------------------------------------------
// refreshGeneratedShelf — public
// ---------------------------------------------------------------------------

export async function refreshGeneratedShelf(
  shelfId: string,
  profileId: string,
): Promise<GenerateShelfResponse> {
  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()
  if (shelf.type !== 'GENERATED') throw new ValidationError('Shelf is not a GENERATED shelf')

  const rules = shelf.rules as GeneratedShelfRules
  if (!rules?.seedMediaIds || !Array.isArray(rules.seedMediaIds) || rules.limit == null) {
    throw new ValidationError('Shelf has invalid or missing generation rules')
  }

  const { members, inferredGenreIds, seedTitles } = await resolveGeneratedMembers(
    profileId,
    rules.seedMediaIds,
    { mediaType: rules.mediaType, availableToMe: rules.availableToMe, limit: rules.limit },
  )

  const updatedRules: GeneratedShelfRules = { ...rules, generatedAt: new Date().toISOString() }

  await db.transaction(async (tx) => {
    await tx.delete(shelfMembers).where(eq(shelfMembers.shelfId, shelfId))

    if (members.length > 0) {
      await tx
        .insert(shelfMembers)
        .values(members.map((m, idx) => ({ shelfId, mediaType: m.mediaType, mediaId: m.mediaId, position: idx })))
        .onConflictDoNothing()
    }

    await tx.update(shelves).set({ rules: updatedRules, updatedAt: new Date() }).where(eq(shelves.id, shelfId))
  })

  return {
    shelf: {
      id: shelf.id,
      title: shelf.title,
      type: 'GENERATED',
      layoutHint: shelf.layoutHint as 'ROW' | 'GRID',
      position: shelf.position,
    },
    explanation: { inferredGenreIds, seedTitles, generatedAt: updatedRules.generatedAt },
  }
}
