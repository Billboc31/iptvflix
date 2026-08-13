import { and, eq, gt, inArray, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { reconciliationRuns } from '../db/schema/reconciliation-runs.js'
import { movies } from '../db/schema/movies.js'
import { series } from '../db/schema/series.js'
import { movieAvailabilities, seriesAvailabilities } from '../db/schema/availabilities.js'
import { TitleMatchingService, type MatchItemInput } from './title-matching-service.js'

const MATCH_CONCURRENCY = parseInt(process.env.MATCH_CONCURRENCY ?? '5', 10) || 5
const MATCH_THROTTLE_MS = parseInt(process.env.MATCH_THROTTLE_MS ?? '250', 10) || 0

export interface ReconcileOptions {
  batchSize?: number
  concurrency?: number
  mediaType?: 'MOVIE' | 'SERIES' | 'BOTH'
  dryRun?: boolean
}

export interface ReconcileResult {
  runId: string
  status: 'COMPLETED' | 'FAILED'
  processedCount: number
  matchedCount: number
  mergedCount: number
  ambiguousCount: number
  unmatchedCount: number
  skippedCount: number
  failedCount: number
}

interface RunCounts {
  processedCount: number
  matchedCount: number
  mergedCount: number
  ambiguousCount: number
  unmatchedCount: number
  skippedCount: number
  failedCount: number
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class ReconciliationAlreadyRunningError extends Error {
  constructor(runId: string) {
    super(`A reconciliation run (${runId}) is already in progress`)
    this.name = 'ReconciliationAlreadyRunningError'
  }
}

function isUniqueConstraintError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as Record<string, unknown>).code === '23505'
}

export class MediaReconciliationService {
  constructor(private readonly titleMatchingService: TitleMatchingService) {}

  /** Creates a new RUNNING run row. Throws if one already exists. Returns the runId. */
  async startRun(opts?: ReconcileOptions): Promise<string> {
    const [existing] = await db
      .select({ id: reconciliationRuns.id })
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.status, 'RUNNING'))

    if (existing) throw new ReconciliationAlreadyRunningError(existing.id)

    try {
      const [run] = await db
        .insert(reconciliationRuns)
        .values({ status: 'RUNNING', mediaType: opts?.mediaType ?? 'BOTH' })
        .returning({ id: reconciliationRuns.id })

      return run.id
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        // Two concurrent POSTs raced past the SELECT above — the partial unique index
        // rejected the second INSERT. Translate to the expected error type so callers
        // receive 409 instead of 500.
        const [running] = await db
          .select({ id: reconciliationRuns.id })
          .from(reconciliationRuns)
          .where(eq(reconciliationRuns.status, 'RUNNING'))
        throw new ReconciliationAlreadyRunningError(running?.id ?? 'unknown')
      }
      throw err
    }
  }

  /** Executes reconciliation for an existing RUNNING run. Intended for fire-and-forget from the route. */
  async executeRun(runId: string, opts?: ReconcileOptions): Promise<ReconcileResult> {
    const batchSize = Math.max(1, opts?.batchSize ?? 50)
    const concurrency = opts?.concurrency ?? MATCH_CONCURRENCY
    const mediaType = opts?.mediaType ?? 'BOTH'
    const dryRun = opts?.dryRun ?? false

    const totals: RunCounts = {
      processedCount: 0,
      matchedCount: 0,
      mergedCount: 0,
      ambiguousCount: 0,
      unmatchedCount: 0,
      skippedCount: 0,
      failedCount: 0,
    }

    try {
      if (mediaType === 'MOVIE' || mediaType === 'BOTH') {
        await this._processType('MOVIE', runId, batchSize, concurrency, totals, dryRun)
      }
      if (mediaType === 'SERIES' || mediaType === 'BOTH') {
        await this._processType('SERIES', runId, batchSize, concurrency, totals, dryRun)
      }

      await db
        .update(reconciliationRuns)
        .set({ status: 'COMPLETED', completedAt: new Date(), ...totals })
        .where(eq(reconciliationRuns.id, runId))

      return { runId, status: 'COMPLETED', ...totals }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      await db
        .update(reconciliationRuns)
        .set({ status: 'FAILED', completedAt: new Date(), errorMessage, ...totals })
        .where(eq(reconciliationRuns.id, runId))
      return { runId, status: 'FAILED', ...totals }
    }
  }

  /** Convenience wrapper for tests: starts a run and immediately executes it. */
  async reconcile(opts?: ReconcileOptions): Promise<ReconcileResult> {
    const runId = await this.startRun(opts)
    return this.executeRun(runId, opts)
  }

  private async _processType(
    type: 'MOVIE' | 'SERIES',
    runId: string,
    batchSize: number,
    concurrency: number,
    totals: RunCounts,
    dryRun: boolean,
  ): Promise<void> {
    // Resume from cursor stored in the run row
    const [currentRun] = await db
      .select({ cursorMovieId: reconciliationRuns.cursorMovieId, cursorSeriesId: reconciliationRuns.cursorSeriesId })
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.id, runId))

    let cursorId: string | null =
      type === 'MOVIE' ? (currentRun?.cursorMovieId ?? null) : (currentRun?.cursorSeriesId ?? null)

    while (true) {
      const page = await this._fetchPage(type, cursorId, batchSize)
      if (page.length === 0) break

      const mediaIds = page.map((m) => m.id)
      const allAvailabilities = await this._fetchAvailabilities(type, mediaIds)

      const availByMedia = new Map<string, typeof allAvailabilities>()
      for (const a of allAvailabilities) {
        const list = availByMedia.get(a.mediaId) ?? []
        list.push(a)
        availByMedia.set(a.mediaId, list)
      }

      // Collect all matchItem inputs across the page
      type IndexedInput = { mediaId: string; input: MatchItemInput }
      const indexedInputs: IndexedInput[] = []
      for (const media of page) {
        const avails = availByMedia.get(media.id) ?? []
        for (const a of avails) {
          if (!a.rawTitle) continue
          indexedInputs.push({
            mediaId: media.id,
            input: {
              providerId: a.providerId,
              providerItemId: a.providerItemId,
              rawTitle: a.rawTitle,
              mediaType: type,
            },
          })
        }
      }

      const rawResults =
        indexedInputs.length > 0
          ? await this.titleMatchingService.matchBatch(
              indexedInputs.map((i) => i.input),
              { concurrency, throttleMs: MATCH_THROTTLE_MS },
            )
          : []

      // Group match results by mediaId
      const resultsByMedia = new Map<string, (typeof rawResults)[number][]>()
      for (let i = 0; i < indexedInputs.length; i++) {
        const { mediaId } = indexedInputs[i]
        const list = resultsByMedia.get(mediaId) ?? []
        list.push(rawResults[i])
        resultsByMedia.set(mediaId, list)
      }

      // Page-level counters
      const pageCounts: RunCounts = {
        processedCount: 0,
        matchedCount: 0,
        mergedCount: 0,
        ambiguousCount: 0,
        unmatchedCount: 0,
        skippedCount: 0,
        failedCount: 0,
      }

      const lastId = page[page.length - 1].id

      for (const media of page) {
        pageCounts.processedCount++
        const avails = availByMedia.get(media.id) ?? []
        const availsWithTitle = avails.filter((a) => a.rawTitle != null)

        if (availsWithTitle.length === 0) {
          pageCounts.skippedCount++
          continue
        }

        const results = resultsByMedia.get(media.id) ?? []

        // Detect matchBatch failures (id === '' means provider error)
        const hasFailure = results.some((r) => r.id === '' && r.notes?.includes('provider error'))
        if (hasFailure) {
          pageCounts.failedCount++
          continue
        }

        const hasAmbiguous = results.some((r) => r.matchState === 'AMBIGUOUS')
        const allUnmatched = results.every((r) => r.matchState === 'UNMATCHED')
        const matchedResults = results.filter((r) => r.matchState === 'MATCHED')

        if (hasAmbiguous) {
          pageCounts.ambiguousCount++
          continue
        }

        if (allUnmatched) {
          if (!dryRun) {
            const table = type === 'MOVIE' ? movies : series
            await db
              .update(table)
              .set({ matchStatus: 'UNMATCHED', updatedAt: new Date() })
              .where(eq(table.id, media.id))
          }
          pageCounts.unmatchedCount++
          continue
        }

        const canonicalIds = new Set(
          matchedResults
            .map((r) => (type === 'MOVIE' ? r.movieId : r.seriesId))
            .filter((id): id is string => id != null),
        )

        if (canonicalIds.size === 0) {
          pageCounts.ambiguousCount++
          continue
        }

        if (canonicalIds.size > 1) {
          // Disagreement among matched results
          pageCounts.ambiguousCount++
          continue
        }

        const [canonicalId] = canonicalIds
        try {
          if (!dryRun) {
            const outcome = await this._reconcileMedia(media.id, canonicalId, type)
            if (outcome === 'merged') {
              pageCounts.mergedCount++
            } else {
              pageCounts.matchedCount++
            }
          } else {
            // dryRun: count but skip mutations
            if (media.id === canonicalId) {
              pageCounts.matchedCount++
            } else {
              pageCounts.mergedCount++
            }
          }
        } catch {
          pageCounts.failedCount++
        }
      }

      // Accumulate into totals
      for (const key of Object.keys(pageCounts) as (keyof RunCounts)[]) {
        totals[key] += pageCounts[key]
      }

      // Persist cursor and incremental counts
      if (!dryRun) {
        const cursorUpdate =
          type === 'MOVIE' ? { cursorMovieId: lastId } : { cursorSeriesId: lastId }
        await db
          .update(reconciliationRuns)
          .set({
            ...cursorUpdate,
            processedCount: sql`${reconciliationRuns.processedCount} + ${pageCounts.processedCount}`,
            matchedCount: sql`${reconciliationRuns.matchedCount} + ${pageCounts.matchedCount}`,
            mergedCount: sql`${reconciliationRuns.mergedCount} + ${pageCounts.mergedCount}`,
            ambiguousCount: sql`${reconciliationRuns.ambiguousCount} + ${pageCounts.ambiguousCount}`,
            unmatchedCount: sql`${reconciliationRuns.unmatchedCount} + ${pageCounts.unmatchedCount}`,
            skippedCount: sql`${reconciliationRuns.skippedCount} + ${pageCounts.skippedCount}`,
            failedCount: sql`${reconciliationRuns.failedCount} + ${pageCounts.failedCount}`,
          })
          .where(eq(reconciliationRuns.id, runId))
      }

      cursorId = lastId
      if (page.length < batchSize) break
    }
  }

  private async _fetchPage(
    type: 'MOVIE' | 'SERIES',
    cursorId: string | null,
    batchSize: number,
  ): Promise<{ id: string; title: string }[]> {
    const table = type === 'MOVIE' ? movies : series
    const conditions = [inArray(table.matchStatus, ['PENDING', 'UNMATCHED'])]
    if (cursorId) {
      conditions.push(gt(table.id, cursorId))
    }
    return db
      .select({ id: table.id, title: table.title })
      .from(table)
      .where(and(...conditions))
      .orderBy(table.id)
      .limit(batchSize)
  }

  private async _fetchAvailabilities(
    type: 'MOVIE' | 'SERIES',
    mediaIds: string[],
  ): Promise<{ mediaId: string; providerId: string; providerItemId: string; rawTitle: string | null }[]> {
    if (mediaIds.length === 0) return []
    if (type === 'MOVIE') {
      const rows = await db
        .select({
          mediaId: movieAvailabilities.movieId,
          providerId: movieAvailabilities.providerId,
          providerItemId: movieAvailabilities.providerItemId,
          rawTitle: movieAvailabilities.rawTitle,
        })
        .from(movieAvailabilities)
        .where(inArray(movieAvailabilities.movieId, mediaIds))
      return rows
    } else {
      const rows = await db
        .select({
          mediaId: seriesAvailabilities.seriesId,
          providerId: seriesAvailabilities.providerId,
          providerItemId: seriesAvailabilities.providerItemId,
          rawTitle: seriesAvailabilities.rawTitle,
        })
        .from(seriesAvailabilities)
        .where(inArray(seriesAvailabilities.seriesId, mediaIds))
      return rows
    }
  }

  private async _reconcileMedia(
    oldId: string,
    canonicalId: string,
    type: 'MOVIE' | 'SERIES',
  ): Promise<'matched' | 'merged'> {
    if (oldId === canonicalId) {
      const table = type === 'MOVIE' ? movies : series
      await db
        .update(table)
        .set({ matchStatus: 'MATCHED', updatedAt: new Date() })
        .where(eq(table.id, oldId))
      return 'matched'
    }

    await db.transaction(async (tx) => {
      if (type === 'MOVIE') {
        await this._migrateMovieData(oldId, canonicalId, tx)
      } else {
        await this._migrateSeriesData(oldId, canonicalId, tx)
      }
    })
    return 'merged'
  }

  private async _migrateMovieData(oldId: string, canonicalId: string, tx: DbTx): Promise<void> {
    // Availabilities: move non-conflicting, delete leftovers
    await tx.execute(sql`
      UPDATE movie_availabilities
      SET movie_id = ${canonicalId}
      WHERE movie_id = ${oldId}
        AND NOT EXISTS (
          SELECT 1 FROM movie_availabilities ma2
          WHERE ma2.provider_id = movie_availabilities.provider_id
            AND ma2.provider_item_id = movie_availabilities.provider_item_id
            AND ma2.movie_id = ${canonicalId}
        )
    `)
    await tx.execute(sql`DELETE FROM movie_availabilities WHERE movie_id = ${oldId}`)

    // Genres
    await tx.execute(sql`
      INSERT INTO movie_genres (movie_id, genre_id)
      SELECT ${canonicalId}, genre_id FROM movie_genres WHERE movie_id = ${oldId}
      ON CONFLICT DO NOTHING
    `)
    await tx.execute(sql`DELETE FROM movie_genres WHERE movie_id = ${oldId}`)

    // Discovery candidates
    await tx.execute(sql`
      UPDATE discovery_candidates SET canonical_movie_id = ${canonicalId}
      WHERE canonical_movie_id = ${oldId}
    `)

    // Shared user-state migration
    await this._migrateUserState(oldId, canonicalId, 'MOVIE', tx)

    // Media credits and videos (no unique constraint per media)
    await tx.execute(sql`
      UPDATE media_credits SET media_id = ${canonicalId}
      WHERE media_id = ${oldId} AND media_type = 'MOVIE'
    `)
    await tx.execute(sql`
      UPDATE media_videos SET media_id = ${canonicalId}
      WHERE media_id = ${oldId} AND media_type = 'MOVIE'
    `)

    // Title match results
    await tx.execute(sql`
      UPDATE title_match_results SET movie_id = ${canonicalId}
      WHERE movie_id = ${oldId}
    `)

    // Delete old movie row (cascade handles remaining child rows)
    await tx.execute(sql`DELETE FROM movies WHERE id = ${oldId}`)

    // Mark canonical as MATCHED
    await tx.execute(sql`
      UPDATE movies SET match_status = 'MATCHED', updated_at = now()
      WHERE id = ${canonicalId}
    `)
  }

  private async _migrateSeriesData(oldId: string, canonicalId: string, tx: DbTx): Promise<void> {
    // Availabilities
    await tx.execute(sql`
      UPDATE series_availabilities
      SET series_id = ${canonicalId}
      WHERE series_id = ${oldId}
        AND NOT EXISTS (
          SELECT 1 FROM series_availabilities sa2
          WHERE sa2.provider_id = series_availabilities.provider_id
            AND sa2.provider_item_id = series_availabilities.provider_item_id
            AND sa2.series_id = ${canonicalId}
        )
    `)
    await tx.execute(sql`DELETE FROM series_availabilities WHERE series_id = ${oldId}`)

    // Genres
    await tx.execute(sql`
      INSERT INTO series_genres (series_id, genre_id)
      SELECT ${canonicalId}, genre_id FROM series_genres WHERE series_id = ${oldId}
      ON CONFLICT DO NOTHING
    `)
    await tx.execute(sql`DELETE FROM series_genres WHERE series_id = ${oldId}`)

    // Discovery candidates
    await tx.execute(sql`
      UPDATE discovery_candidates SET canonical_series_id = ${canonicalId}
      WHERE canonical_series_id = ${oldId}
    `)

    // Shared user-state migration
    await this._migrateUserState(oldId, canonicalId, 'SERIES', tx)

    // Media credits and videos
    await tx.execute(sql`
      UPDATE media_credits SET media_id = ${canonicalId}
      WHERE media_id = ${oldId} AND media_type = 'SERIES'
    `)
    await tx.execute(sql`
      UPDATE media_videos SET media_id = ${canonicalId}
      WHERE media_id = ${oldId} AND media_type = 'SERIES'
    `)

    // Title match results
    await tx.execute(sql`
      UPDATE title_match_results SET series_id = ${canonicalId}
      WHERE series_id = ${oldId}
    `)

    // Delete old series row
    await tx.execute(sql`DELETE FROM series WHERE id = ${oldId}`)

    // Mark canonical as MATCHED
    await tx.execute(sql`
      UPDATE series SET match_status = 'MATCHED', updated_at = now()
      WHERE id = ${canonicalId}
    `)
  }

  private async _migrateUserState(
    oldId: string,
    canonicalId: string,
    type: 'MOVIE' | 'SERIES',
    tx: DbTx,
  ): Promise<void> {
    // Release events: move non-conflicting rows to canonical, delete conflicting ones.
    // Step 1: UPDATE non-conflicting release_events to canonicalId
    await tx.execute(sql`
      UPDATE release_events re
      SET media_id = ${canonicalId}
      WHERE re.media_id = ${oldId}
        AND re.media_type = ${type}::release_event_media_type
        AND CASE
          WHEN re.event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED') THEN
            NOT EXISTS (
              SELECT 1 FROM release_events re2
              WHERE re2.media_id = ${canonicalId}
                AND re2.media_type = re.media_type
                AND re2.event_type = re.event_type
                AND re2.occurred_at = re.occurred_at
                AND re2.source_id IS NOT DISTINCT FROM re.source_id
            )
          ELSE
            NOT EXISTS (
              SELECT 1 FROM release_events re2
              WHERE re2.media_id = ${canonicalId}
                AND re2.media_type = re.media_type
                AND re2.event_type = re.event_type
                AND re2.occurred_at = re.occurred_at
            )
        END
    `)

    // Step 2: Update media_arrivals.media_id for all rows pointing to old media
    await tx.execute(sql`
      UPDATE media_arrivals
      SET media_id = ${canonicalId}
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
    `)

    // Step 3: Delete media_arrivals whose release_event_id still points to old release_events
    //         (those that conflicted and couldn't be migrated)
    await tx.execute(sql`
      DELETE FROM media_arrivals
      WHERE release_event_id IN (
        SELECT id FROM release_events
        WHERE media_id = ${oldId} AND media_type = ${type}::release_event_media_type
      )
    `)

    // Step 4: Delete remaining old release_events (RESTRICT FK is now clear)
    await tx.execute(sql`
      DELETE FROM release_events
      WHERE media_id = ${oldId} AND media_type = ${type}::release_event_media_type
    `)

    // Watchlist
    await tx.execute(sql`
      INSERT INTO watchlist (id, profile_id, media_type, media_id, added_at)
      SELECT gen_random_uuid(), profile_id, media_type, ${canonicalId}, added_at
      FROM watchlist
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
      ON CONFLICT (profile_id, media_type, media_id) DO NOTHING
    `)
    await tx.execute(sql`
      DELETE FROM watchlist
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
    `)

    // Viewing progress (only MOVIE type exists in progress_media_type; SERIES has no direct progress)
    if (type === 'MOVIE') {
      await tx.execute(sql`
        INSERT INTO viewing_progress (id, profile_id, media_type, media_id, progress_seconds, duration_seconds, last_watched_at, updated_at)
        SELECT gen_random_uuid(), profile_id, media_type, ${canonicalId}, progress_seconds, duration_seconds, last_watched_at, updated_at
        FROM viewing_progress
        WHERE media_id = ${oldId} AND media_type = 'MOVIE'::progress_media_type
        ON CONFLICT (profile_id, media_type, media_id) DO NOTHING
      `)
      await tx.execute(sql`
        DELETE FROM viewing_progress
        WHERE media_id = ${oldId} AND media_type = 'MOVIE'::progress_media_type
      `)
    }

    // Explicit feedback
    await tx.execute(sql`
      INSERT INTO explicit_feedback (id, profile_id, media_type, media_id, feedback, created_at, updated_at)
      SELECT gen_random_uuid(), profile_id, media_type, ${canonicalId}, feedback, created_at, updated_at
      FROM explicit_feedback
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
      ON CONFLICT (profile_id, media_type, media_id) DO NOTHING
    `)
    await tx.execute(sql`
      DELETE FROM explicit_feedback
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
    `)

    // Shelf members
    await tx.execute(sql`
      INSERT INTO shelf_members (id, shelf_id, media_type, media_id, position, added_at)
      SELECT gen_random_uuid(), shelf_id, media_type, ${canonicalId}, position, added_at
      FROM shelf_members
      WHERE media_id = ${oldId} AND media_type = ${type}::shelf_media_type
      ON CONFLICT (shelf_id, media_type, media_id) DO NOTHING
    `)
    await tx.execute(sql`
      DELETE FROM shelf_members
      WHERE media_id = ${oldId} AND media_type = ${type}::shelf_media_type
    `)

    // Follow release
    await tx.execute(sql`
      INSERT INTO follow_release (id, profile_id, media_type, media_id, followed_at)
      SELECT gen_random_uuid(), profile_id, media_type, ${canonicalId}, followed_at
      FROM follow_release
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
      ON CONFLICT (profile_id, media_type, media_id) DO NOTHING
    `)
    await tx.execute(sql`
      DELETE FROM follow_release
      WHERE media_id = ${oldId} AND media_type = ${type}::watchlist_media_type
    `)

    // Profile taste: replace oldId in positive/negative media ID arrays
    await tx.execute(sql`
      UPDATE profile_taste
      SET
        positive_media_ids = array_replace(positive_media_ids, ${oldId}::text, ${canonicalId}::text),
        negative_media_ids = array_replace(negative_media_ids, ${oldId}::text, ${canonicalId}::text)
      WHERE ${oldId}::text = ANY(positive_media_ids) OR ${oldId}::text = ANY(negative_media_ids)
    `)
  }
}
