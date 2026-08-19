import { eq, inArray, and, gt, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelves,
  shelfMembers,
  movies,
  series,
  movieGenres,
  seriesGenres,
  movieAvailabilities,
  seriesAvailabilities,
  discoveryCandidate,
  profileTaste,
} from '../db/schema.js'
import type { GenerateShelfBody, GeneratedShelfRules, GenerateShelfResponse, SeedMediaRef } from '@iptvflix/api-contracts'

class ValidationError extends Error { constructor(message: string) { super(message); this.name = 'ValidationError' } }
class NotFoundError extends Error { constructor(resource: string, id: string) { super(`${resource} ${id} not found`); this.name = 'NotFoundError' } }
class ForbiddenError extends Error { constructor() { super('Forbidden'); this.name = 'ForbiddenError' } }

export { ValidationError, NotFoundError, ForbiddenError }

// ─── Simple genre-based ranking (local implementation for shelf seeds) ─────────

type InternalCandidate = {
  mediaId: string
  title: string
  year: number | null
  posterPath: string | null
  mediaType: 'MOVIE' | 'SERIES'
  source: 'LOCAL' | 'DISCOVERY'
  genreIds: string[]
  popularity: number | null
  voteAverage: number | null
}

async function rankCandidatesForShelf(
  profileId: string,
  opts: { mediaType?: 'MOVIE' | 'SERIES'; availableToMe?: boolean; limit: number; preferGenreIds?: string[] },
): Promise<InternalCandidate[]> {
  const [tasteRows, movieRows, seriesRows, movieGenreRows, seriesGenreRows, discoveryRows, availMovieRows, availSeriesRows] = await Promise.all([
    db.select({ genreScores: profileTaste.genreScores, positiveMediaIds: profileTaste.positiveMediaIds, negativeMediaIds: profileTaste.negativeMediaIds, signalCount: profileTaste.signalCount })
      .from(profileTaste).where(eq(profileTaste.profileId, profileId)),
    !opts.mediaType || opts.mediaType === 'MOVIE'
      ? db.select({ id: movies.id, title: movies.title, year: movies.year, posterPath: movies.posterPath, popularity: movies.popularity, voteAverage: movies.voteAverage }).from(movies)
      : Promise.resolve([]),
    !opts.mediaType || opts.mediaType === 'SERIES'
      ? db.select({ id: series.id, title: series.title, year: series.firstAirYear, posterPath: series.posterPath, popularity: series.popularity, voteAverage: series.voteAverage }).from(series)
      : Promise.resolve([]),
    db.select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId }).from(movieGenres),
    db.select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId }).from(seriesGenres),
    db.select({ id: discoveryCandidate.id, title: discoveryCandidate.title, year: discoveryCandidate.year, posterPath: discoveryCandidate.posterPath, mediaType: discoveryCandidate.mediaType, canonicalMovieId: discoveryCandidate.canonicalMovieId, canonicalSeriesId: discoveryCandidate.canonicalSeriesId, popularity: discoveryCandidate.popularity, voteAverage: discoveryCandidate.voteAverage }).from(discoveryCandidate).where(gt(discoveryCandidate.expiresAt, new Date())),
    db.select({ movieId: movieAvailabilities.movieId }).from(movieAvailabilities).where(eq(movieAvailabilities.status, 'AVAILABLE')),
    db.select({ seriesId: seriesAvailabilities.seriesId }).from(seriesAvailabilities).where(eq(seriesAvailabilities.status, 'AVAILABLE')),
  ])

  const tasteRow = tasteRows[0]
  const coldStart = !tasteRow || tasteRow.signalCount === 0
  const genreScores = (tasteRow?.genreScores ?? {}) as Record<string, number>
  const negativeMediaIds = new Set<string>(tasteRow?.negativeMediaIds ?? [])
  const preferGenreSet = new Set<string>(opts.preferGenreIds ?? [])

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
  const localMovieIds = new Set(movieRows.map((m) => m.id))
  const localSeriesIds = new Set(seriesRows.map((s) => s.id))

  const candidates: InternalCandidate[] = []

  for (const m of movieRows) {
    candidates.push({ mediaId: m.id, title: m.title, year: m.year, posterPath: m.posterPath, mediaType: 'MOVIE', source: 'LOCAL', genreIds: movieGenreMap.get(m.id) ?? [], popularity: m.popularity, voteAverage: m.voteAverage })
  }
  for (const s of seriesRows) {
    candidates.push({ mediaId: s.id, title: s.title, year: s.year, posterPath: s.posterPath, mediaType: 'SERIES', source: 'LOCAL', genreIds: seriesGenreMap.get(s.id) ?? [], popularity: s.popularity, voteAverage: s.voteAverage })
  }
  for (const dc of discoveryRows) {
    const dcMediaType = dc.mediaType as 'MOVIE' | 'SERIES'
    if (opts.mediaType && dcMediaType !== opts.mediaType) continue
    if (dcMediaType === 'MOVIE' && dc.canonicalMovieId && localMovieIds.has(dc.canonicalMovieId)) continue
    if (dcMediaType === 'SERIES' && dc.canonicalSeriesId && localSeriesIds.has(dc.canonicalSeriesId)) continue
    const effectiveMediaId = dcMediaType === 'MOVIE' ? (dc.canonicalMovieId ?? dc.id) : (dc.canonicalSeriesId ?? dc.id)
    const genreIds = dcMediaType === 'MOVIE'
      ? (dc.canonicalMovieId ? (movieGenreMap.get(dc.canonicalMovieId) ?? []) : [])
      : (dc.canonicalSeriesId ? (seriesGenreMap.get(dc.canonicalSeriesId) ?? []) : [])
    candidates.push({ mediaId: effectiveMediaId, title: dc.title, year: dc.year, posterPath: dc.posterPath, mediaType: dcMediaType, source: 'DISCOVERY', genreIds, popularity: dc.popularity, voteAverage: dc.voteAverage })
  }

  const filtered = candidates.filter((c) => {
    if (negativeMediaIds.has(c.mediaId)) return false
    if (opts.availableToMe) {
      const avail = c.mediaType === 'MOVIE' ? availMovieSet.has(c.mediaId) : availSeriesSet.has(c.mediaId)
      if (!avail) return false
    }
    return true
  })

  const preferGenreBonus = (genreIds: string[]) => preferGenreSet.size > 0 && genreIds.some((gId) => preferGenreSet.has(gId)) ? 3.0 : 0

  const scored = filtered.map((c) => {
    let score: number
    if (coldStart) {
      score = (c.popularity ?? 0) * (c.voteAverage ?? 0) + preferGenreBonus(c.genreIds)
    } else {
      const genreAffinity = c.genreIds.reduce((sum, gId) => sum + (genreScores[gId] ?? 0), 0)
      score = genreAffinity + preferGenreBonus(c.genreIds)
    }
    return { ...c, score }
  })

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return a.mediaId.localeCompare(b.mediaId)
  })

  return scored.slice(0, opts.limit)
}

// ─── Materialize discovery candidate ──────────────────────────────────────────

async function materializeDiscoveryCandidate(candidateId: string, mediaType: 'MOVIE' | 'SERIES'): Promise<string> {
  const [dc] = await db.select().from(discoveryCandidate).where(eq(discoveryCandidate.id, candidateId))
  if (!dc) throw new ValidationError(`Discovery candidate not found: ${candidateId}`)

  if (mediaType === 'MOVIE') {
    if (dc.canonicalMovieId) return dc.canonicalMovieId
    const [newMovie] = await db.insert(movies).values({ title: dc.title, year: dc.year, synopsis: dc.synopsis, posterPath: dc.posterPath, metadataProvider: dc.provenance } as any).returning({ id: movies.id })
    await db.update(discoveryCandidate).set({ canonicalMovieId: newMovie.id }).where(eq(discoveryCandidate.id, candidateId))
    return newMovie.id
  } else {
    if (dc.canonicalSeriesId) return dc.canonicalSeriesId
    const [newSeries] = await db.insert(series).values({ title: dc.title, firstAirYear: dc.year, synopsis: dc.synopsis, posterPath: dc.posterPath, metadataProvider: dc.provenance } as any).returning({ id: series.id })
    await db.update(discoveryCandidate).set({ canonicalSeriesId: newSeries.id }).where(eq(discoveryCandidate.id, candidateId))
    return newSeries.id
  }
}

// ─── Shared core logic ─────────────────────────────────────────────────────────

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
  const seedTitles: string[] = []

  const [movieSeedRows, seriesSeedRows] = await Promise.all([
    seedMovieIds.length > 0 ? db.select({ id: movies.id, title: movies.title }).from(movies).where(inArray(movies.id, seedMovieIds)) : Promise.resolve([]),
    seedSeriesIds.length > 0 ? db.select({ id: series.id, title: series.title }).from(series).where(inArray(series.id, seedSeriesIds)) : Promise.resolve([]),
  ])

  const foundMovieIds = new Set(movieSeedRows.map((r) => r.id))
  const foundSeriesIds = new Set(seriesSeedRows.map((r) => r.id))

  for (const seed of seedMediaIds) {
    if (seed.mediaType === 'MOVIE') {
      if (!foundMovieIds.has(seed.mediaId)) throw new ValidationError(`Seed media not found: ${seed.mediaId}`)
      seedTitles.push(movieSeedRows.find((r) => r.id === seed.mediaId)!.title)
    } else {
      if (!foundSeriesIds.has(seed.mediaId)) throw new ValidationError(`Seed media not found: ${seed.mediaId}`)
      seedTitles.push(seriesSeedRows.find((r) => r.id === seed.mediaId)!.title)
    }
  }

  const [movieGenreRows, seriesGenreRows] = await Promise.all([
    seedMovieIds.length > 0 ? db.select({ genreId: movieGenres.genreId }).from(movieGenres).where(inArray(movieGenres.movieId, seedMovieIds)) : Promise.resolve([]),
    seedSeriesIds.length > 0 ? db.select({ genreId: seriesGenres.genreId }).from(seriesGenres).where(inArray(seriesGenres.seriesId, seedSeriesIds)) : Promise.resolve([]),
  ])

  const inferredGenreIdSet = new Set<string>()
  for (const r of movieGenreRows) inferredGenreIdSet.add(r.genreId)
  for (const r of seriesGenreRows) inferredGenreIdSet.add(r.genreId)
  const inferredGenreIds = [...inferredGenreIdSet]

  const recs = await rankCandidatesForShelf(profileId, { preferGenreIds: inferredGenreIds, mediaType: opts.mediaType, availableToMe: opts.availableToMe, limit: opts.limit + seedMediaIds.length })

  const seedIdSet = new Set(seedMediaIds.map((s) => s.mediaId))
  const candidates = recs.filter((c) => !seedIdSet.has(c.mediaId)).slice(0, opts.limit)

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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateShelfFromSeeds(profileId: string, body: GenerateShelfBody): Promise<GenerateShelfResponse> {
  const { title, seedMediaIds, mediaType, availableToMe, limit: rawLimit } = body

  if (!Array.isArray(seedMediaIds) || seedMediaIds.length < 3 || seedMediaIds.length > 10) {
    throw new ValidationError('seedMediaIds must have between 3 and 10 entries')
  }
  const uniqueSeedIds = new Set(seedMediaIds.map((s) => s.mediaId))
  if (uniqueSeedIds.size !== seedMediaIds.length) throw new ValidationError('seedMediaIds must not contain duplicate mediaId values')

  const limit = Math.min(Math.max(rawLimit ?? 20, 1), 100)
  const { members, inferredGenreIds, seedTitles } = await resolveGeneratedMembers(profileId, seedMediaIds, { mediaType, availableToMe, limit })
  const generatedAt = new Date().toISOString()
  const rules: GeneratedShelfRules = { seedMediaIds, mediaType, availableToMe, limit, inferredGenreIds, generatedAt }

  const shelf = await db.transaction(async (tx) => {
    const [{ maxPos }] = await tx.select({ maxPos: sql<number>`coalesce(max(${shelves.position}), -1)` }).from(shelves).where(eq(shelves.profileId, profileId))
    const position = (maxPos ?? -1) + 1
    const [inserted] = await tx.insert(shelves).values({ profileId, title, type: 'GENERATED', rules, position, layoutHint: 'ROW' } as any).returning()
    if (members.length > 0) {
      await tx.insert(shelfMembers).values(members.map((m, idx) => ({ shelfId: inserted.id, mediaType: m.mediaType, mediaId: m.mediaId, position: idx } as any))).onConflictDoNothing()
    }
    return inserted
  })

  return {
    shelf: { id: shelf.id, title: shelf.title, type: 'GENERATED', layoutHint: shelf.layoutHint as 'ROW' | 'GRID', position: shelf.position },
    explanation: { inferredGenreIds, seedTitles, generatedAt },
  }
}

export async function refreshGeneratedShelf(shelfId: string, profileId: string): Promise<GenerateShelfResponse> {
  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()
  if (shelf.type !== 'GENERATED') throw new ValidationError('Shelf is not a GENERATED shelf')

  const rules = shelf.rules as GeneratedShelfRules
  if (!rules?.seedMediaIds || !Array.isArray(rules.seedMediaIds) || rules.limit == null) {
    throw new ValidationError('Shelf has invalid or missing generation rules')
  }

  const { members, inferredGenreIds, seedTitles } = await resolveGeneratedMembers(profileId, rules.seedMediaIds, { mediaType: rules.mediaType, availableToMe: rules.availableToMe, limit: rules.limit })
  const updatedRules: GeneratedShelfRules = { ...rules, generatedAt: new Date().toISOString() }

  await db.transaction(async (tx) => {
    await tx.delete(shelfMembers).where(eq(shelfMembers.shelfId, shelfId))
    if (members.length > 0) {
      await tx.insert(shelfMembers).values(members.map((m, idx) => ({ shelfId, mediaType: m.mediaType, mediaId: m.mediaId, position: idx } as any))).onConflictDoNothing()
    }
    await tx.update(shelves).set({ rules: updatedRules, updatedAt: new Date() } as any).where(eq(shelves.id, shelfId))
  })

  return {
    shelf: { id: shelf.id, title: shelf.title, type: 'GENERATED', layoutHint: shelf.layoutHint as 'ROW' | 'GRID', position: shelf.position },
    explanation: { inferredGenreIds, seedTitles, generatedAt: updatedRules.generatedAt },
  }
}
