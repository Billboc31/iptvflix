import { and, eq, inArray, lt } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { movieAvailabilities, seriesAvailabilities } from '../db/schema/availabilities.js'
import { syncRuns } from '../db/schema/sync-runs.js'
import type { XtreamCatalogSnapshot } from '../providers/xtream/types.js'

export interface CatalogSyncResult {
  runId: string
  status: 'completed' | 'failed'
  counts: {
    moviesCreated: number
    moviesUpdated: number
    seriesCreated: number
    seriesUpdated: number
    unavailableCount: number
    failedCount: number
  }
  error?: string
}

export class SyncAlreadyRunningError extends Error {
  constructor(sourceId: string) {
    super(`Sync already running for source ${sourceId}`)
    this.name = 'SyncAlreadyRunningError'
  }
}

const STALE_LOCK_MS = 10 * 60 * 1000

/** Postgres `integer` / Drizzle `integer()` range (signed int4). */
const PG_INT4_MAX = 2_147_483_647

/**
 * Parse a provider "tmdb" field into a storable id.
 * Xtream often sends garbage (stream ids, etc.) larger than int4 — reject those
 * so sync does not die with `integer out of range` on `movies.tmdb_id`.
 */
function parseTmdbId(tmdb: string | undefined): number | null {
  if (!tmdb) return null
  const n = parseInt(tmdb, 10)
  if (Number.isNaN(n) || n <= 0 || n > PG_INT4_MAX) return null
  return n
}

function parseYear(dateStr: string | undefined): number | null {
  if (!dateStr || dateStr.length < 4) return null
  const n = parseInt(dateStr.substring(0, 4), 10)
  return isNaN(n) ? null : n
}

function isUniqueConstraintViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const code =
    (err as { code?: string }).code ??
    (err as { cause?: { code?: string } }).cause?.code
  return code === '23505'
}

async function resolveMovieId(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  stream: { name: string; cover?: string; plot?: string; description?: string; tmdb?: string },
): Promise<string> {
  const tmdbId = parseTmdbId(stream.tmdb)

  if (tmdbId != null) {
    const [existingByTmdb] = await tx
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1)
    if (existingByTmdb) return existingByTmdb.id

    const inserted = await tx
      .insert(movies)
      .values({
        title: stream.name,
        posterPath: stream.cover ?? null,
        synopsis: stream.plot ?? stream.description ?? null,
        year: null,
        tmdbId,
      })
      .onConflictDoNothing({ target: movies.tmdbId })
      .returning({ id: movies.id })

    if (inserted[0]) return inserted[0].id

    const [row] = await tx
      .select({ id: movies.id })
      .from(movies)
      .where(eq(movies.tmdbId, tmdbId))
      .limit(1)
    if (row) return row.id
    throw new Error(`Failed to resolve movie for tmdbId=${tmdbId}`)
  }

  const [inserted] = await tx
    .insert(movies)
    .values({
      title: stream.name,
      posterPath: stream.cover ?? null,
      synopsis: stream.plot ?? stream.description ?? null,
      year: null,
      tmdbId: null,
    })
    .returning({ id: movies.id })
  return inserted.id
}

export const CatalogSyncService = {
  async syncCatalog(sourceId: string, snapshot: XtreamCatalogSnapshot): Promise<CatalogSyncResult> {
    // Clear any stale RUNNING lock for this source
    const staleThreshold = new Date(Date.now() - STALE_LOCK_MS)
    await db
      .update(syncRuns)
      .set({ status: 'FAILED', completedAt: new Date(), errorMessage: 'stale lock cleared' })
      .where(
        and(
          eq(syncRuns.sourceId, sourceId),
          eq(syncRuns.status, 'RUNNING'),
          lt(syncRuns.startedAt, staleThreshold),
        ),
      )

    // Acquire lock by inserting a RUNNING run record
    let runId: string
    try {
      const [run] = await db
        .insert(syncRuns)
        .values({ sourceId, status: 'RUNNING' })
        .returning()
      runId = run.id
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new SyncAlreadyRunningError(sourceId)
      }
      throw err
    }

    const counts = {
      moviesCreated: 0,
      moviesUpdated: 0,
      seriesCreated: 0,
      seriesUpdated: 0,
      unavailableCount: 0,
      failedCount: 0,
    }
    let syncError: Error | undefined

    try {
      await db.transaction(async (tx) => {
        // Collect currently AVAILABLE items for this source before sync
        const prevMovieRows = await tx
          .select({ providerItemId: movieAvailabilities.providerItemId })
          .from(movieAvailabilities)
          .where(
            and(
              eq(movieAvailabilities.providerId, sourceId),
              eq(movieAvailabilities.status, 'AVAILABLE'),
            ),
          )
        const previouslyAvailableMovieIds = new Set(prevMovieRows.map((r) => r.providerItemId))

        const prevSeriesRows = await tx
          .select({ providerItemId: seriesAvailabilities.providerItemId })
          .from(seriesAvailabilities)
          .where(
            and(
              eq(seriesAvailabilities.providerId, sourceId),
              eq(seriesAvailabilities.status, 'AVAILABLE'),
            ),
          )
        const previouslyAvailableSeriesIds = new Set(prevSeriesRows.map((r) => r.providerItemId))

        // Sync VOD streams
        const seenMovieProviderItemIds = new Set<string>()
        for (const stream of snapshot.vodStreams) {
          const providerItemId = stream.stream_id.toString()
          const [existing] = await tx
            .select({ id: movieAvailabilities.id })
            .from(movieAvailabilities)
            .where(
              and(
                eq(movieAvailabilities.providerId, sourceId),
                eq(movieAvailabilities.providerItemId, providerItemId),
              ),
            )

          if (!existing) {
            const movieId = await resolveMovieId(tx, stream)
            await tx.insert(movieAvailabilities).values({
              movieId,
              providerId: sourceId,
              providerItemId,
              firstSeenAt: snapshot.fetchedAt,
              lastSeenAt: snapshot.fetchedAt,
              status: 'AVAILABLE',
            })
            counts.moviesCreated++
          } else {
            await tx
              .update(movieAvailabilities)
              .set({ lastSeenAt: snapshot.fetchedAt, status: 'AVAILABLE', unavailableAt: null })
              .where(
                and(
                  eq(movieAvailabilities.providerId, sourceId),
                  eq(movieAvailabilities.providerItemId, providerItemId),
                ),
              )
            counts.moviesUpdated++
          }
          seenMovieProviderItemIds.add(providerItemId)
        }

        // Sync series
        const seenSeriesProviderItemIds = new Set<string>()
        for (const s of snapshot.series) {
          const providerItemId = s.series_id.toString()
          const [existing] = await tx
            .select({ id: seriesAvailabilities.id })
            .from(seriesAvailabilities)
            .where(
              and(
                eq(seriesAvailabilities.providerId, sourceId),
                eq(seriesAvailabilities.providerItemId, providerItemId),
              ),
            )

          if (!existing) {
            const [seriesRow] = await tx
              .insert(series)
              .values({
                title: s.name,
                posterPath: s.cover ?? null,
                synopsis: s.plot ?? null,
                firstAirYear: parseYear(s.releaseDate),
              })
              .returning()
            await tx.insert(seriesAvailabilities).values({
              seriesId: seriesRow.id,
              providerId: sourceId,
              providerItemId,
              firstSeenAt: snapshot.fetchedAt,
              lastSeenAt: snapshot.fetchedAt,
              status: 'AVAILABLE',
            })
            counts.seriesCreated++
          } else {
            await tx
              .update(seriesAvailabilities)
              .set({ lastSeenAt: snapshot.fetchedAt, status: 'AVAILABLE', unavailableAt: null })
              .where(
                and(
                  eq(seriesAvailabilities.providerId, sourceId),
                  eq(seriesAvailabilities.providerItemId, providerItemId),
                ),
              )
            counts.seriesUpdated++
          }
          seenSeriesProviderItemIds.add(providerItemId)
        }

        // Mark previously available items not in this snapshot as UNAVAILABLE
        const missingMovieIds = [...previouslyAvailableMovieIds].filter(
          (id) => !seenMovieProviderItemIds.has(id),
        )
        if (missingMovieIds.length > 0) {
          await tx
            .update(movieAvailabilities)
            .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
            .where(
              and(
                eq(movieAvailabilities.providerId, sourceId),
                eq(movieAvailabilities.status, 'AVAILABLE'),
                inArray(movieAvailabilities.providerItemId, missingMovieIds),
              ),
            )
          counts.unavailableCount += missingMovieIds.length
        }

        const missingSeriesIds = [...previouslyAvailableSeriesIds].filter(
          (id) => !seenSeriesProviderItemIds.has(id),
        )
        if (missingSeriesIds.length > 0) {
          await tx
            .update(seriesAvailabilities)
            .set({ status: 'UNAVAILABLE', unavailableAt: snapshot.fetchedAt })
            .where(
              and(
                eq(seriesAvailabilities.providerId, sourceId),
                eq(seriesAvailabilities.status, 'AVAILABLE'),
                inArray(seriesAvailabilities.providerItemId, missingSeriesIds),
              ),
            )
          counts.unavailableCount += missingSeriesIds.length
        }
      })
    } catch (err) {
      syncError = err instanceof Error ? err : new Error(String(err))
    }

    // Release lock — always runs regardless of sync outcome
    if (syncError) {
      await db
        .update(syncRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage: syncError.message })
        .where(eq(syncRuns.id, runId))
      return { runId, status: 'failed', counts, error: syncError.message }
    }

    await db
      .update(syncRuns)
      .set({
        status: 'COMPLETED',
        completedAt: new Date(),
        moviesCreated: counts.moviesCreated,
        moviesUpdated: counts.moviesUpdated,
        seriesCreated: counts.seriesCreated,
        seriesUpdated: counts.seriesUpdated,
        unavailableCount: counts.unavailableCount,
        failedCount: counts.failedCount,
      })
      .where(eq(syncRuns.id, runId))

    return { runId, status: 'completed', counts }
  },
}
