import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { episodes } from '../db/schema/episodes.js'
import { seasons } from '../db/schema/seasons.js'
import { series } from '../db/schema/series.js'
import { mediaSegments } from '../db/schema/media-segments.js'
import type { RawSegment, SegmentProvider } from '../providers/segments/types.js'
import { resolveAndPersistSeriesImdbId } from './imdb-resolver.js'
import type { TmdbClient } from '../providers/metadata/tmdb/client.js'
import { withBoundedConcurrency } from './sync-runs-service.js'

type Db = PostgresJsDatabase<typeof schema>

export interface SyncCounters {
  found: number
  noData: number
  errors: number
  mismatches: number
}

export interface BackfillOptions {
  concurrency: number
  dryRun?: boolean
  force?: boolean
}

export interface BackfillResult extends SyncCounters {
  total: number
  processed: number
}

export class SegmentSyncService {
  constructor(
    private readonly db: Db,
    private readonly tmdbClient: TmdbClient,
    private readonly providers: SegmentProvider[],
  ) {}

  async upsertSegments(episodeId: string, segments: RawSegment[]): Promise<void> {
    if (segments.length === 0) return
    await this.db
      .insert(mediaSegments)
      .values(
        segments.map((s) => ({
          episodeId,
          type: s.type,
          startMs: s.startMs,
          endMs: s.endMs,
          sourceProvider: s.sourceProvider,
          sourceExternalId: s.sourceExternalId ?? null,
          confidence: s.confidence ?? null,
          submissionCount: s.submissionCount ?? null,
          sourceUpdatedAt: s.sourceUpdatedAt ?? null,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [mediaSegments.episodeId, mediaSegments.type, mediaSegments.sourceProvider],
        set: {
          startMs: sql`excluded.start_ms`,
          endMs: sql`excluded.end_ms`,
          confidence: sql`excluded.confidence`,
          submissionCount: sql`excluded.submission_count`,
          sourceExternalId: sql`excluded.source_external_id`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          updatedAt: sql`now()`,
        },
      })
  }

  async syncEpisode(
    episodeId: string,
    seriesId: string,
    seasonNumber: number,
    episodeNumber: number,
  ): Promise<SyncCounters> {
    const counters: SyncCounters = { found: 0, noData: 0, errors: 0, mismatches: 0 }

    if (seasonNumber === 0) {
      console.warn(JSON.stringify({
        level: 'warn',
        event: 'segment_numbering_ambiguous',
        episodeId,
        reason: 'season_0_specials_skipped',
      }))
      counters.mismatches++
      return counters
    }

    let imdbId: string | null
    try {
      imdbId = await resolveAndPersistSeriesImdbId(this.db, this.tmdbClient, seriesId)
    } catch (err) {
      console.error('[segment-sync] IMDb resolution failed', { episodeId, seriesId, err })
      counters.errors++
      return counters
    }

    const episodeRef = { episodeId, seriesImdbId: imdbId, seasonNumber, episodeNumber }

    let allSegments: RawSegment[] = []
    for (const provider of this.providers) {
      try {
        const segments = await provider.fetchEpisodeSegments(episodeRef)
        allSegments = allSegments.concat(segments)
      } catch (err) {
        console.error('[segment-sync] Provider fetch failed', { episodeId, provider: provider.constructor.name, err })
        counters.errors++
      }
    }

    if (allSegments.length === 0) {
      counters.noData++
    } else {
      try {
        await this.upsertSegments(episodeId, allSegments)
        counters.found += allSegments.length
      } catch (err) {
        console.error('[segment-sync] Upsert failed', { episodeId, err })
        counters.errors++
      }
    }

    return counters
  }

  async syncEpisodeById(episodeId: string): Promise<SyncCounters> {
    const [row] = await this.db
      .select({
        episodeId: episodes.id,
        episodeNumber: episodes.episodeNumber,
        seriesId: episodes.seriesId,
        seasonNumber: seasons.seasonNumber,
      })
      .from(episodes)
      .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
      .where(eq(episodes.id, episodeId))
      .limit(1)

    if (!row) return { found: 0, noData: 0, errors: 1, mismatches: 0 }

    return this.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber)
  }

  async backfillCatalog(opts: BackfillOptions): Promise<BackfillResult> {
    const totals: BackfillResult = { total: 0, processed: 0, found: 0, noData: 0, errors: 0, mismatches: 0 }

    const PAGE_SIZE = 200
    let offset = 0
    let hasMore = true

    while (hasMore) {
      const rows = await this.db
        .select({
          episodeId: episodes.id,
          episodeNumber: episodes.episodeNumber,
          seriesId: episodes.seriesId,
          seasonNumber: seasons.seasonNumber,
        })
        .from(episodes)
        .innerJoin(seasons, eq(episodes.seasonId, seasons.id))
        .innerJoin(series, eq(episodes.seriesId, series.id))
        .where(isNotNull(series.tmdbId))
        .limit(PAGE_SIZE)
        .offset(offset)

      if (rows.length === 0) break
      if (rows.length < PAGE_SIZE) hasMore = false
      offset += rows.length
      totals.total += rows.length

      const toProcess = opts.force
        ? rows
        : await this.filterUnsynced(rows.map((r) => r.episodeId), rows)

      if (opts.dryRun) {
        totals.processed += toProcess.length
        this.printProgress(totals)
        continue
      }

      const tasks = toProcess.map((row) => async () => {
        const counters = await this.syncEpisode(row.episodeId, row.seriesId, row.seasonNumber, row.episodeNumber)
        totals.processed++
        totals.found += counters.found
        totals.noData += counters.noData
        totals.errors += counters.errors
        totals.mismatches += counters.mismatches
        this.printProgress(totals)
      })

      await withBoundedConcurrency(tasks, opts.concurrency)
    }

    return totals
  }

  private async filterUnsynced(
    episodeIds: string[],
    rows: Array<{ episodeId: string; seriesId: string; seasonNumber: number; episodeNumber: number }>,
  ): Promise<typeof rows> {
    if (episodeIds.length === 0) return []

    const existing = await this.db
      .selectDistinct({ episodeId: mediaSegments.episodeId })
      .from(mediaSegments)
      .where(inArray(mediaSegments.episodeId, episodeIds))

    const synced = new Set(existing.map((r) => r.episodeId))
    return rows.filter((r) => !synced.has(r.episodeId))
  }

  private printProgress(totals: BackfillResult): void {
    console.log(JSON.stringify({
      event: 'segment_backfill_progress',
      total: totals.total,
      processed: totals.processed,
      found: totals.found,
      noData: totals.noData,
      errors: totals.errors,
      mismatches: totals.mismatches,
    }))
  }
}
