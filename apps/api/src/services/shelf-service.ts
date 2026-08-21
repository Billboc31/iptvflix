import { resolveMediaImageUrl } from '../lib/tmdb-image.js'
import { and, eq, desc, asc, inArray, notInArray, gte, lte, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import {
  shelves,
  shelfMembers,
  movies,
  series,
  movieAvailabilities,
  seriesAvailabilities,
  viewingProgress,
  movieGenres,
  seriesGenres,
  mediaVideos,
} from '../db/schema/index.js'
import { NotFoundError, ForbiddenError, ValidationError } from '../errors.js'
import { listContinueWatching } from './viewing-progress-service.js'
import { listWatchlist } from './watchlist-service.js'
import type {
  ShelfResponse,
  ShelfSummaryResponse,
  ShelfItem,
  ShelfRuleDefinition,
  GeneratedShelfRules,
  CreateShelfBody,
  UpdateShelfBody,
  AddShelfMemberBody,
} from '@iptvflix/api-contracts'

// ---------------------------------------------------------------------------
// Trailer key helpers
// ---------------------------------------------------------------------------

async function fetchTrailerKeys(mediaType: 'movie' | 'series', ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map()
  const rows = await db
    .select({ mediaId: mediaVideos.mediaId, youtubeKey: mediaVideos.youtubeKey })
    .from(mediaVideos)
    .where(and(eq(mediaVideos.mediaType, mediaType), inArray(mediaVideos.mediaId, ids)))
  const map = new Map<string, string>()
  for (const r of rows) {
    if (!map.has(r.mediaId)) map.set(r.mediaId, r.youtubeKey)
  }
  return map
}

// ---------------------------------------------------------------------------
// System shelf definitions (no DB rows — resolved at runtime)
// ---------------------------------------------------------------------------

const SYSTEM_SHELF_DEFS: ShelfSummaryResponse[] = [
  { id: 'sys_continue_watching', title: 'Continuer à regarder', type: 'SYSTEM', layoutHint: 'ROW', position: 0 },
  { id: 'sys_recently_added_movies', title: 'Récemment ajoutés — Films', type: 'SYSTEM', layoutHint: 'ROW', position: 1 },
  { id: 'sys_recently_added_series', title: 'Récemment ajoutées — Séries', type: 'SYSTEM', layoutHint: 'ROW', position: 2 },
  { id: 'sys_my_list', title: 'Ma liste', type: 'SYSTEM', layoutHint: 'ROW', position: 3 },
]

const SYSTEM_SHELF_IDS = new Set(SYSTEM_SHELF_DEFS.map((s) => s.id))

function isSystemId(id: string): boolean {
  return SYSTEM_SHELF_IDS.has(id)
}

// ---------------------------------------------------------------------------
// System shelf resolvers
// ---------------------------------------------------------------------------

async function resolveSystemShelf(id: string, profileId: string): Promise<ShelfItem[]> {
  if (id === 'sys_continue_watching') {
    const items = await listContinueWatching(profileId)
    const movieIds = items.filter((i) => i.mediaType === 'MOVIE').map((i) => i.mediaId)
    const movieTrailers = await fetchTrailerKeys('movie', movieIds)
    return items.map((item) => ({
      mediaType: item.mediaType === 'MOVIE' ? 'MOVIE' : ('SERIES' as const),
      mediaId: item.mediaId,
      title: item.title,
      posterUrl: item.posterUrl,
      progressSeconds: item.progressSeconds,
      durationSeconds: item.durationSeconds,
      // Episodes in continue-watching don't carry the parent series ID, so trailerKey is null for them
      trailerKey: item.mediaType === 'MOVIE' ? (movieTrailers.get(item.mediaId) ?? null) : null,
    }))
  }

  if (id === 'sys_my_list') {
    const entries = await listWatchlist(profileId)
    const movieIds = entries.filter((e) => e.mediaType === 'MOVIE').map((e) => e.mediaId)
    const seriesIds = entries.filter((e) => e.mediaType === 'SERIES').map((e) => e.mediaId)
    const [movieTrailers, seriesTrailers] = await Promise.all([
      fetchTrailerKeys('movie', movieIds),
      fetchTrailerKeys('series', seriesIds),
    ])
    return entries.map((e) => ({
      mediaType: e.mediaType,
      mediaId: e.mediaId,
      title: e.title,
      posterUrl: e.posterUrl,
      trailerKey: (e.mediaType === 'MOVIE' ? movieTrailers : seriesTrailers).get(e.mediaId) ?? null,
    }))
  }

  if (id === 'sys_recently_added_movies') {
    const rows = await db
      .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
      .from(movies)
      .orderBy(desc(movies.createdAt))
      .limit(20)
    const trailerMap = await fetchTrailerKeys('movie', rows.map((r) => r.id))
    return rows.map((r) => ({
      mediaType: 'MOVIE' as const,
      mediaId: r.id,
      title: r.title,
      posterUrl: resolveMediaImageUrl(r.posterPath),
      trailerKey: trailerMap.get(r.id) ?? null,
    }))
  }

  if (id === 'sys_recently_added_series') {
    const rows = await db
      .select({ id: series.id, title: series.title, posterPath: series.posterPath })
      .from(series)
      .orderBy(desc(series.createdAt))
      .limit(20)
    const trailerMap = await fetchTrailerKeys('series', rows.map((r) => r.id))
    return rows.map((r) => ({
      mediaType: 'SERIES' as const,
      mediaId: r.id,
      title: r.title,
      posterUrl: resolveMediaImageUrl(r.posterPath),
      trailerKey: trailerMap.get(r.id) ?? null,
    }))
  }

  return []
}

// ---------------------------------------------------------------------------
// Dynamic rule validation
// ---------------------------------------------------------------------------

const ALLOWED_RULE_KEYS = new Set(['mediaType', 'genreIds', 'yearFrom', 'yearTo', 'availableToMe', 'watchState'])

export function validateDynamicRules(rawRules: unknown): ShelfRuleDefinition {
  if (typeof rawRules !== 'object' || rawRules === null || Array.isArray(rawRules)) {
    throw new ValidationError('rules must be a plain object')
  }

  const input = rawRules as Record<string, unknown>

  for (const key of Object.keys(input)) {
    if (!ALLOWED_RULE_KEYS.has(key)) {
      throw new ValidationError(`Unknown rule field: "${key}"`)
    }
  }

  const result: ShelfRuleDefinition = {}

  if ('mediaType' in input) {
    if (input.mediaType !== 'MOVIE' && input.mediaType !== 'SERIES') {
      throw new ValidationError('mediaType must be "MOVIE" or "SERIES"')
    }
    result.mediaType = input.mediaType
  }

  if ('genreIds' in input) {
    if (!Array.isArray(input.genreIds) || !input.genreIds.every((id: unknown) => typeof id === 'string')) {
      throw new ValidationError('genreIds must be an array of strings')
    }
    result.genreIds = input.genreIds as string[]
  }

  if ('yearFrom' in input) {
    if (typeof input.yearFrom !== 'number' || !Number.isInteger(input.yearFrom) || input.yearFrom < 0) {
      throw new ValidationError('yearFrom must be a non-negative integer')
    }
    result.yearFrom = input.yearFrom
  }

  if ('yearTo' in input) {
    if (typeof input.yearTo !== 'number' || !Number.isInteger(input.yearTo) || input.yearTo < 0) {
      throw new ValidationError('yearTo must be a non-negative integer')
    }
    result.yearTo = input.yearTo
  }

  if ('availableToMe' in input) {
    if (typeof input.availableToMe !== 'boolean') {
      throw new ValidationError('availableToMe must be a boolean')
    }
    result.availableToMe = input.availableToMe
  }

  if ('watchState' in input) {
    if (input.watchState !== 'UNWATCHED' && input.watchState !== 'IN_PROGRESS' && input.watchState !== 'COMPLETED') {
      throw new ValidationError('watchState must be "UNWATCHED", "IN_PROGRESS", or "COMPLETED"')
    }
    if (result.mediaType !== 'MOVIE') {
      throw new ValidationError("watchState is only supported when mediaType is 'MOVIE'")
    }
    result.watchState = input.watchState
  }

  return result
}

// ---------------------------------------------------------------------------
// Dynamic shelf evaluation
// ---------------------------------------------------------------------------

async function evaluateMovies(rules: ShelfRuleDefinition, profileId: string): Promise<ShelfItem[]> {
  const conditions = [
    rules.yearFrom != null ? gte(movies.year, rules.yearFrom) : undefined,
    rules.yearTo != null ? lte(movies.year, rules.yearTo) : undefined,
    rules.genreIds?.length
      ? inArray(
          movies.id,
          db.select({ id: movieGenres.movieId }).from(movieGenres).where(inArray(movieGenres.genreId, rules.genreIds)),
        )
      : undefined,
    rules.availableToMe === true
      ? inArray(
          movies.id,
          db
            .select({ id: movieAvailabilities.movieId })
            .from(movieAvailabilities)
            .where(eq(movieAvailabilities.status, 'AVAILABLE')),
        )
      : rules.availableToMe === false
        ? notInArray(
            movies.id,
            db
              .select({ id: movieAvailabilities.movieId })
              .from(movieAvailabilities)
              .where(eq(movieAvailabilities.status, 'AVAILABLE')),
          )
        : undefined,
    rules.watchState === 'IN_PROGRESS'
      ? inArray(
          movies.id,
          db
            .select({ id: viewingProgress.mediaId })
            .from(viewingProgress)
            .where(
              and(
                eq(viewingProgress.profileId, profileId),
                eq(viewingProgress.mediaType, 'MOVIE'),
                sql`${viewingProgress.progressSeconds} >= 2`,
                sql`(
                  ${viewingProgress.progressSeconds} < ${viewingProgress.durationSeconds} * 0.90
                  OR ${viewingProgress.durationSeconds} < 600
                )`,
              ),
            ),
        )
      : undefined,
    rules.watchState === 'COMPLETED'
      ? inArray(
          movies.id,
          db
            .select({ id: viewingProgress.mediaId })
            .from(viewingProgress)
            .where(
              and(
                eq(viewingProgress.profileId, profileId),
                eq(viewingProgress.mediaType, 'MOVIE'),
                sql`${viewingProgress.durationSeconds} >= 600`,
                sql`${viewingProgress.progressSeconds} >= ${viewingProgress.durationSeconds} * 0.90`,
              ),
            ),
        )
      : undefined,
    rules.watchState === 'UNWATCHED'
      ? notInArray(
          movies.id,
          db
            .select({ id: viewingProgress.mediaId })
            .from(viewingProgress)
            .where(
              and(
                eq(viewingProgress.profileId, profileId),
                eq(viewingProgress.mediaType, 'MOVIE'),
                sql`${viewingProgress.progressSeconds} >= ${viewingProgress.durationSeconds} * 0.05`,
              ),
            ),
        )
      : undefined,
  ].filter(Boolean) as Parameters<typeof and>

  const rows = await db
    .select({ id: movies.id, title: movies.title, posterPath: movies.posterPath })
    .from(movies)
    .where(and(...conditions))
    .orderBy(desc(movies.createdAt))
    .limit(50)

  const trailerMap = await fetchTrailerKeys('movie', rows.map((r) => r.id))
  return rows.map((r) => ({
    mediaType: 'MOVIE' as const,
    mediaId: r.id,
    title: r.title,
    posterUrl: resolveMediaImageUrl(r.posterPath),
    trailerKey: trailerMap.get(r.id) ?? null,
  }))
}

async function evaluateSeries(rules: ShelfRuleDefinition): Promise<ShelfItem[]> {
  const conditions = [
    rules.yearFrom != null ? gte(series.firstAirYear, rules.yearFrom) : undefined,
    rules.yearTo != null ? lte(series.firstAirYear, rules.yearTo) : undefined,
    rules.genreIds?.length
      ? inArray(
          series.id,
          db
            .select({ id: seriesGenres.seriesId })
            .from(seriesGenres)
            .where(inArray(seriesGenres.genreId, rules.genreIds)),
        )
      : undefined,
    rules.availableToMe === true
      ? inArray(
          series.id,
          db
            .select({ id: seriesAvailabilities.seriesId })
            .from(seriesAvailabilities)
            .where(eq(seriesAvailabilities.status, 'AVAILABLE')),
        )
      : rules.availableToMe === false
        ? notInArray(
            series.id,
            db
              .select({ id: seriesAvailabilities.seriesId })
              .from(seriesAvailabilities)
              .where(eq(seriesAvailabilities.status, 'AVAILABLE')),
          )
        : undefined,
  ].filter(Boolean) as Parameters<typeof and>

  const rows = await db
    .select({ id: series.id, title: series.title, posterPath: series.posterPath })
    .from(series)
    .where(and(...conditions))
    .orderBy(desc(series.createdAt))
    .limit(50)

  const trailerMap = await fetchTrailerKeys('series', rows.map((r) => r.id))
  return rows.map((r) => ({
    mediaType: 'SERIES' as const,
    mediaId: r.id,
    title: r.title,
    posterUrl: resolveMediaImageUrl(r.posterPath),
    trailerKey: trailerMap.get(r.id) ?? null,
  }))
}

export async function evaluateDynamicShelf(rules: ShelfRuleDefinition, profileId: string): Promise<ShelfItem[]> {
  if (rules.mediaType === 'MOVIE') return evaluateMovies(rules, profileId)
  if (rules.mediaType === 'SERIES') return evaluateSeries(rules)

  const [movieItems, seriesItems] = await Promise.all([
    evaluateMovies(rules, profileId),
    evaluateSeries(rules),
  ])
  return [...movieItems, ...seriesItems].slice(0, 50)
}

// ---------------------------------------------------------------------------
// Manual shelf member resolution
// ---------------------------------------------------------------------------

async function resolveManualItems(shelfId: string): Promise<ShelfItem[]> {
  const members = await db
    .select()
    .from(shelfMembers)
    .where(eq(shelfMembers.shelfId, shelfId))
    .orderBy(asc(shelfMembers.position))

  if (members.length === 0) return []

  const movieIds = members.filter((m) => m.mediaType === 'MOVIE').map((m) => m.mediaId)
  const seriesIds = members.filter((m) => m.mediaType === 'SERIES').map((m) => m.mediaId)

  const [movieRows, seriesRows, movieTrailers, seriesTrailers] = await Promise.all([
    movieIds.length > 0
      ? db.select({ id: movies.id, title: movies.title, posterPath: movies.posterPath }).from(movies).where(inArray(movies.id, movieIds))
      : Promise.resolve([]),
    seriesIds.length > 0
      ? db.select({ id: series.id, title: series.title, posterPath: series.posterPath }).from(series).where(inArray(series.id, seriesIds))
      : Promise.resolve([]),
    fetchTrailerKeys('movie', movieIds),
    fetchTrailerKeys('series', seriesIds),
  ])

  const movieMap = new Map(movieRows.map((r) => [r.id, r]))
  const seriesMap = new Map(seriesRows.map((r) => [r.id, r]))

  return members.map((m) => {
    if (m.mediaType === 'MOVIE') {
      const meta = movieMap.get(m.mediaId)
      return {
        mediaType: 'MOVIE' as const,
        mediaId: m.mediaId,
        title: meta?.title ?? m.mediaId,
        posterUrl: resolveMediaImageUrl(meta?.posterPath),
        trailerKey: movieTrailers.get(m.mediaId) ?? null,
      }
    } else {
      const meta = seriesMap.get(m.mediaId)
      return {
        mediaType: 'SERIES' as const,
        mediaId: m.mediaId,
        title: meta?.title ?? m.mediaId,
        posterUrl: resolveMediaImageUrl(meta?.posterPath),
        trailerKey: seriesTrailers.get(m.mediaId) ?? null,
      }
    }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function listShelves(profileId: string): Promise<ShelfSummaryResponse[]> {
  const userRows = await db
    .select()
    .from(shelves)
    .where(eq(shelves.profileId, profileId))
    .orderBy(asc(shelves.position))

  const userSummaries: ShelfSummaryResponse[] = userRows.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type as 'MANUAL' | 'DYNAMIC' | 'GENERATED',
    layoutHint: r.layoutHint as 'ROW' | 'GRID',
    position: r.position,
  }))

  return [...SYSTEM_SHELF_DEFS, ...userSummaries]
}

export async function getShelf(shelfId: string, profileId: string): Promise<ShelfResponse> {
  // System shelf
  const systemDef = SYSTEM_SHELF_DEFS.find((s) => s.id === shelfId)
  if (systemDef) {
    const items = await resolveSystemShelf(shelfId, profileId)
    return { id: systemDef.id, title: systemDef.title, type: 'SYSTEM', layoutHint: systemDef.layoutHint, items }
  }

  // User shelf
  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()

  let items: ShelfItem[]
  if (shelf.type === 'MANUAL' || shelf.type === 'GENERATED') {
    items = await resolveManualItems(shelfId)
  } else {
    // DYNAMIC
    const rules = validateDynamicRules(shelf.rules)
    items = await evaluateDynamicShelf(rules, profileId)
  }

  return {
    id: shelf.id,
    title: shelf.title,
    type: shelf.type as 'MANUAL' | 'DYNAMIC' | 'GENERATED',
    layoutHint: shelf.layoutHint as 'ROW' | 'GRID',
    items,
    ...(shelf.type === 'GENERATED'
      ? { generatedAt: (shelf.rules as GeneratedShelfRules).generatedAt }
      : {}),
  }
}

export async function createShelf(profileId: string, body: CreateShelfBody): Promise<ShelfSummaryResponse> {
  const rules = body.type === 'DYNAMIC' ? validateDynamicRules(body.rules ?? {}) : undefined

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${shelves.position}), -1)` })
    .from(shelves)
    .where(eq(shelves.profileId, profileId))

  const position = (maxPos ?? -1) + 1

  const [row] = await db
    .insert(shelves)
    .values({
      profileId,
      title: body.title,
      type: body.type,
      rules: rules ?? null,
      position,
      layoutHint: body.layoutHint ?? 'ROW',
    })
    .returning()

  return {
    id: row.id,
    title: row.title,
    type: row.type as 'MANUAL' | 'DYNAMIC' | 'GENERATED',
    layoutHint: row.layoutHint as 'ROW' | 'GRID',
    position: row.position,
  }
}

export async function updateShelf(shelfId: string, profileId: string, body: UpdateShelfBody): Promise<ShelfSummaryResponse> {
  if (isSystemId(shelfId)) throw new ForbiddenError('Cannot modify system shelves')

  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()

  const [row] = await db
    .update(shelves)
    .set({
      ...(body.title != null ? { title: body.title } : {}),
      ...(body.layoutHint != null ? { layoutHint: body.layoutHint } : {}),
      updatedAt: new Date(),
    })
    .where(eq(shelves.id, shelfId))
    .returning()

  return {
    id: row.id,
    title: row.title,
    type: row.type as 'MANUAL' | 'DYNAMIC' | 'GENERATED',
    layoutHint: row.layoutHint as 'ROW' | 'GRID',
    position: row.position,
  }
}

export async function deleteShelf(shelfId: string, profileId: string): Promise<void> {
  if (isSystemId(shelfId)) throw new ForbiddenError('Cannot delete system shelves')

  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()

  await db.delete(shelves).where(eq(shelves.id, shelfId))
}

export async function addMember(shelfId: string, profileId: string, body: AddShelfMemberBody): Promise<void> {
  if (isSystemId(shelfId)) throw new ForbiddenError('Cannot add members to system shelves')

  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()
  if (shelf.type !== 'MANUAL') throw new ValidationError('Can only add members to MANUAL shelves')

  // Validate media exists
  if (body.mediaType === 'MOVIE') {
    const [row] = await db.select({ id: movies.id }).from(movies).where(eq(movies.id, body.mediaId))
    if (!row) throw new NotFoundError('Movie', body.mediaId)
  } else {
    const [row] = await db.select({ id: series.id }).from(series).where(eq(series.id, body.mediaId))
    if (!row) throw new NotFoundError('Series', body.mediaId)
  }

  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${shelfMembers.position}), -1)` })
    .from(shelfMembers)
    .where(eq(shelfMembers.shelfId, shelfId))

  const position = (maxPos ?? -1) + 1

  await db
    .insert(shelfMembers)
    .values({ shelfId, mediaType: body.mediaType, mediaId: body.mediaId, position })
    .onConflictDoNothing()
}

export async function removeMember(
  shelfId: string,
  profileId: string,
  mediaType: 'MOVIE' | 'SERIES',
  mediaId: string,
): Promise<void> {
  if (isSystemId(shelfId)) throw new ForbiddenError('Cannot remove members from system shelves')

  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()

  await db
    .delete(shelfMembers)
    .where(
      and(
        eq(shelfMembers.shelfId, shelfId),
        eq(shelfMembers.mediaType, mediaType),
        eq(shelfMembers.mediaId, mediaId),
      ),
    )
}

export async function reorderMembers(
  shelfId: string,
  profileId: string,
  orderedList: Array<{ mediaType: 'MOVIE' | 'SERIES'; mediaId: string }>,
): Promise<void> {
  if (isSystemId(shelfId)) throw new ForbiddenError('Cannot reorder members of system shelves')

  const [shelf] = await db.select().from(shelves).where(eq(shelves.id, shelfId))
  if (!shelf) throw new NotFoundError('Shelf', shelfId)
  if (shelf.profileId !== profileId) throw new ForbiddenError()

  await db.transaction(async (tx) => {
    for (const [index, member] of orderedList.entries()) {
      await tx
        .update(shelfMembers)
        .set({ position: index })
        .where(
          and(
            eq(shelfMembers.shelfId, shelfId),
            eq(shelfMembers.mediaType, member.mediaType),
            eq(shelfMembers.mediaId, member.mediaId),
          ),
        )
    }
  })
}
