import 'dotenv/config'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { seasons } from '../../db/schema/seasons.js'
import { episodes } from '../../db/schema/episodes.js'
import { mediaSegments } from '../../db/schema/media-segments.js'
import { segmentSelections } from '../../db/schema/segment-selections.js'
import { SegmentSyncService } from '../segment-sync-service.js'
import type { CanonicalEpisodeRef, RawSegment, SegmentProvider } from '../../providers/segments/types.js'
import type { TmdbClient } from '../../providers/metadata/tmdb/client.js'

const T_TMDB_SERIES = 9_600_001

function makeProvider(segments: RawSegment[]): SegmentProvider {
  return { fetchEpisodeSegments: vi.fn().mockResolvedValue(segments) }
}

function makeTmdbClient(imdbId: string | null = 'tt1234567'): TmdbClient {
  return {
    getSeriesExternalIds: vi.fn().mockResolvedValue({ imdb_id: imdbId }),
  } as unknown as TmdbClient
}

const INTRO_SEGMENT: RawSegment = {
  type: 'INTRO',
  startMs: 60000,
  endMs: 120000,
  sourceProvider: 'introdb',
  confidence: 0.9,
  submissionCount: 10,
}

const RECAP_SEGMENT: RawSegment = {
  type: 'RECAP',
  startMs: 0,
  endMs: 30000,
  sourceProvider: 'introdb',
}

let testSeriesId: string
let testSeasonId: string
let testEpisodeId: string
let testEpisodeId2: string

beforeEach(async () => {
  const [ser] = await db
    .insert(seriesTable)
    .values({ title: 'Test Series T096', tmdbId: T_TMDB_SERIES })
    .returning({ id: seriesTable.id })
  testSeriesId = ser.id

  const [szn] = await db
    .insert(seasons)
    .values({ seriesId: testSeriesId, seasonNumber: 1 })
    .returning({ id: seasons.id })
  testSeasonId = szn.id

  const [ep1] = await db
    .insert(episodes)
    .values({ seriesId: testSeriesId, seasonId: testSeasonId, episodeNumber: 1 })
    .returning({ id: episodes.id })
  testEpisodeId = ep1.id

  const [ep2] = await db
    .insert(episodes)
    .values({ seriesId: testSeriesId, seasonId: testSeasonId, episodeNumber: 2 })
    .returning({ id: episodes.id })
  testEpisodeId2 = ep2.id
})

afterEach(async () => {
  await db.delete(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
  await db.delete(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId2))
  await db.delete(episodes).where(eq(episodes.seriesId, testSeriesId))
  await db.delete(seasons).where(eq(seasons.seriesId, testSeriesId))
  await db.delete(seriesTable).where(eq(seriesTable.id, testSeriesId))
})

describe('SegmentSyncService', () => {
  describe('upsertSegments()', () => {
    it('inserts segments and is idempotent on second call', async () => {
      const svc = new SegmentSyncService(db, makeTmdbClient(), [])
      await svc.upsertSegments(testEpisodeId, [INTRO_SEGMENT])

      const rows1 = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows1).toHaveLength(1)

      await svc.upsertSegments(testEpisodeId, [INTRO_SEGMENT])
      const rows2 = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows2).toHaveLength(1)
      expect(rows2[0].startMs).toBe(60000)
    })

    it('updates existing segment on conflict', async () => {
      const svc = new SegmentSyncService(db, makeTmdbClient(), [])
      await svc.upsertSegments(testEpisodeId, [INTRO_SEGMENT])
      const updated: RawSegment = { ...INTRO_SEGMENT, startMs: 65000, endMs: 130000 }
      await svc.upsertSegments(testEpisodeId, [updated])

      const rows = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows).toHaveLength(1)
      expect(rows[0].startMs).toBe(65000)
    })

    it('stores sourceProvider on every row (provenance)', async () => {
      const svc = new SegmentSyncService(db, makeTmdbClient(), [])
      await svc.upsertSegments(testEpisodeId, [INTRO_SEGMENT])
      const [row] = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(row.sourceProvider).toBe('introdb')
    })
  })

  describe('syncEpisode()', () => {
    it('fetches from provider and inserts segments', async () => {
      const provider = makeProvider([INTRO_SEGMENT, RECAP_SEGMENT])
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      const counters = await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      expect(counters.found).toBe(2)
      expect(counters.noData).toBe(0)
      expect(counters.errors).toBe(0)

      const rows = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows).toHaveLength(2)
    })

    it('returns noData counter when provider returns empty array', async () => {
      const provider = makeProvider([])
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      const counters = await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      expect(counters.noData).toBe(1)
      expect(counters.found).toBe(0)
      expect(counters.errors).toBe(0)

      const rows = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows).toHaveLength(0)
    })

    it('logs warning and inserts no rows for season 0 specials', async () => {
      const provider = makeProvider([INTRO_SEGMENT])
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const counters = await svc.syncEpisode(testEpisodeId, testSeriesId, 0, 1)

      expect(counters.mismatches).toBe(1)
      expect(counters.found).toBe(0)
      expect(consoleSpy).toHaveBeenCalled()
      const warnArg: string = consoleSpy.mock.calls[0][0] as string
      expect(warnArg).toContain('segment_numbering_ambiguous')

      const rows = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows).toHaveLength(0)

      consoleSpy.mockRestore()
    })

    it('counts error when provider throws', async () => {
      const provider: SegmentProvider = {
        fetchEpisodeSegments: vi.fn().mockRejectedValue(new Error('network failure')),
      }
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      const counters = await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      expect(counters.errors).toBeGreaterThan(0)
    })

    it('passes imdbId from series to provider', async () => {
      const provider = makeProvider([INTRO_SEGMENT])
      const tmdb = makeTmdbClient('tt9876543')
      const svc = new SegmentSyncService(db, tmdb, [provider])
      await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      const call = (provider.fetchEpisodeSegments as ReturnType<typeof vi.fn>).mock.calls[0][0] as CanonicalEpisodeRef
      expect(call.seriesImdbId).toBe('tt9876543')
      expect(call.seasonNumber).toBe(1)
      expect(call.episodeNumber).toBe(1)
    })

    it('handles anime episode correctly (RECAP + INTRO mapping)', async () => {
      const animeSegments: RawSegment[] = [
        { type: 'RECAP', startMs: 0, endMs: 95000, sourceProvider: 'introdb' },
        { type: 'INTRO', startMs: 95000, endMs: 185000, sourceProvider: 'introdb' },
        { type: 'OUTRO', startMs: 1330000, endMs: 1410000, sourceProvider: 'introdb', submissionCount: 200 },
      ]
      const provider = makeProvider(animeSegments)
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      const counters = await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      expect(counters.found).toBe(3)
      const rows = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rows).toHaveLength(3)
      const outro = rows.find((r) => r.type === 'OUTRO')!
      expect(outro.submissionCount).toBe(200)
    })
  })

  describe('syncEpisodeById()', () => {
    it('resolves episode from DB and syncs', async () => {
      const provider = makeProvider([INTRO_SEGMENT])
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      const counters = await svc.syncEpisodeById(testEpisodeId)

      expect(counters.found).toBe(1)
    })

    it('returns error counter for unknown episodeId', async () => {
      const svc = new SegmentSyncService(db, makeTmdbClient(), [])
      const counters = await svc.syncEpisodeById('00000000-0000-0000-0000-000000000000')
      expect(counters.errors).toBe(1)
    })
  })

  describe('multi-provider path (T097)', () => {
    const INTRO_INTRODB: RawSegment = {
      type: 'INTRO',
      startMs: 60000,
      endMs: 120000,
      sourceProvider: 'introdb',
      submissionCount: 10,
    }
    const INTRO_THEINTRODB: RawSegment = {
      type: 'INTRO',
      startMs: 60500,
      endMs: 120500,
      sourceProvider: 'theintrodb',
      submissionCount: 5,
    }

    it('two providers succeed — merged selection is upserted into segment_selections', async () => {
      const p1 = makeProvider([INTRO_INTRODB])
      const p2 = makeProvider([INTRO_THEINTRODB])
      const svc = new SegmentSyncService(db, makeTmdbClient(), [p1, p2], ['introdb', 'theintrodb'])
      await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      const selections = await db.select().from(segmentSelections).where(eq(segmentSelections.episodeId, testEpisodeId))
      expect(selections).toHaveLength(1)
      expect(selections[0].type).toBe('INTRO')
      // introdb has higher submissionCount — wins
      expect(selections[0].selectedProvider).toBe('introdb')
      expect(selections[0].selectionReason).toBe('cluster-consensus')
      const provenance = selections[0].provenance as Array<{ provider: string }>
      expect(provenance).toHaveLength(2)
    })

    it('one provider fails — the other provider raw rows are stored and merge runs on partial data', async () => {
      const p1 = makeProvider([INTRO_INTRODB])
      const p2: SegmentProvider = {
        fetchEpisodeSegments: vi.fn().mockRejectedValue(new Error('network error')),
      }
      const svc = new SegmentSyncService(db, makeTmdbClient(), [p1, p2], ['introdb', 'theintrodb'])
      const counters = await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      // Error is counted for the failing provider
      expect(counters.errors).toBe(1)
      // But raw segments from the successful provider are stored
      const rawRows = await db.select().from(mediaSegments).where(eq(mediaSegments.episodeId, testEpisodeId))
      expect(rawRows).toHaveLength(1)
      expect(rawRows[0].sourceProvider).toBe('introdb')
      // Merge runs on partial data → selection stored
      const selections = await db.select().from(segmentSelections).where(eq(segmentSelections.episodeId, testEpisodeId))
      expect(selections).toHaveLength(1)
      expect(selections[0].selectionReason).toBe('sole-provider')
    })

    it('idempotent — second sync overwrites segment_selections without creating duplicates', async () => {
      const svc = new SegmentSyncService(db, makeTmdbClient(), [makeProvider([INTRO_INTRODB])], ['introdb'])
      await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)
      await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      const selections = await db.select().from(segmentSelections).where(eq(segmentSelections.episodeId, testEpisodeId))
      expect(selections).toHaveLength(1)
    })

    it('passes seriesTmdbId to providers via CanonicalEpisodeRef', async () => {
      const provider = makeProvider([INTRO_INTRODB])
      const svc = new SegmentSyncService(db, makeTmdbClient(), [provider])
      await svc.syncEpisode(testEpisodeId, testSeriesId, 1, 1)

      const call = (provider.fetchEpisodeSegments as ReturnType<typeof vi.fn>).mock.calls[0][0] as CanonicalEpisodeRef
      expect(call.seriesTmdbId).toBe(T_TMDB_SERIES)
    })

    describe('backfillCatalog — provider-aware filterUnsynced', () => {
      it('re-processes episodes synced by only a subset of configured providers', async () => {
        // Seed both test episodes with IntroDB data only (simulating a T096 backfill)
        const svcIntroDB = new SegmentSyncService(db, makeTmdbClient(), [makeProvider([INTRO_INTRODB])])
        await svcIntroDB.syncEpisode(testEpisodeId, testSeriesId, 1, 1)
        await svcIntroDB.syncEpisode(testEpisodeId2, testSeriesId, 1, 2)

        // Backfill with both providers — episodes only have 1 of 2 providers, so they must be re-processed
        const p2 = makeProvider([INTRO_THEINTRODB])
        const svcBoth = new SegmentSyncService(
          db,
          makeTmdbClient(),
          [makeProvider([INTRO_INTRODB]), p2],
          ['introdb', 'theintrodb'],
        )
        const result = await svcBoth.backfillCatalog({ concurrency: 1, force: false })

        // Both episodes were only partially synced (introdb only), so both should be re-processed
        expect(result.processed).toBeGreaterThanOrEqual(2)
        expect((p2.fetchEpisodeSegments as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(2)

        // After re-sync, testEpisodeId has rows from both providers
        const rows = await db
          .select({ provider: mediaSegments.sourceProvider })
          .from(mediaSegments)
          .where(eq(mediaSegments.episodeId, testEpisodeId))
        const providers = new Set(rows.map((r) => r.provider))
        expect(providers.has('introdb')).toBe(true)
        expect(providers.has('theintrodb')).toBe(true)
      })
    })
  })
})
