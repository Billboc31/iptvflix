import 'dotenv/config'
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { sources } from '../../db/schema/sources.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { seasons } from '../../db/schema/seasons.js'
import { episodes } from '../../db/schema/episodes.js'
import { seriesAvailabilities, episodeAvailabilities } from '../../db/schema/availabilities.js'
import { syncRuns } from '../../db/schema/sync-runs.js'
import { EpisodeBackfillService } from '../episode-backfill-service.js'
import { XtreamCodesClient } from '../../providers/xtream/client.js'
import type { XtreamSeriesInfo } from '../../providers/xtream/types.js'

vi.mock('../../providers/xtream/client.js')

const MockedXtreamCodesClient = vi.mocked(XtreamCodesClient)

let testSourceId: string

function makeSeriesInfo(episodesBySeasonNum: Record<string, Array<{ id: string; episode_num: number; title: string }>>): XtreamSeriesInfo {
  return {
    info: {
      name: 'Test Series',
      cover: '',
      plot: '',
      cast: '',
      director: '',
      genre: '',
      releaseDate: '',
      last_modified: '',
      rating: '0',
      rating_5based: 0,
      backdrop_path: [],
      youtube_trailer: '',
      episode_run_time: '',
      category_id: '1',
      category_name: '',
    },
    episodes: Object.fromEntries(
      Object.entries(episodesBySeasonNum).map(([season, eps]) => [
        season,
        eps.map((ep) => ({
          id: ep.id,
          episode_num: ep.episode_num,
          title: ep.title,
          container_extension: 'mkv',
          info: { duration_secs: 2700, duration: '00:45:00' },
        })),
      ]),
    ),
  }
}

beforeAll(async () => {
  const [source] = await db
    .insert(sources)
    .values({ name: 'Backfill Test Source', type: 'XTREAM', baseUrl: 'http://backfill-test.example.com', username: 'u', password: 'p' })
    .returning()
  testSourceId = source.id
})

afterAll(async () => {
  await db.delete(sources).where(eq(sources.id, testSourceId))
})

afterEach(async () => {
  vi.clearAllMocks()

  const serAvRows = await db
    .select({ seriesId: seriesAvailabilities.seriesId })
    .from(seriesAvailabilities)
    .where(eq(seriesAvailabilities.providerId, testSourceId))
  if (serAvRows.length > 0) {
    const seriesIds = serAvRows.map((r) => r.seriesId)
    await db.delete(seriesTable).where(inArray(seriesTable.id, seriesIds))
  }
  await db.delete(syncRuns).where(eq(syncRuns.sourceId, testSourceId))
})

describe('EpisodeBackfillService', () => {
  it('picks up MATCHED series with zero seasons and ingests their episodes', async () => {
    const [canonicalSeries] = await db
      .insert(seriesTable)
      .values({ title: 'Zero Season Series', matchStatus: 'MATCHED' })
      .returning()

    await db.insert(seriesAvailabilities).values({
      seriesId: canonicalSeries.id,
      providerId: testSourceId,
      providerItemId: '2001',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: 'AVAILABLE',
    })

    const info = makeSeriesInfo({
      '1': [
        { id: 'ep-2001-1', episode_num: 1, title: 'Pilot' },
        { id: 'ep-2001-2', episode_num: 2, title: 'Episode 2' },
      ],
    })

    MockedXtreamCodesClient.prototype.getSeriesInfo = vi.fn().mockResolvedValue(info)

    const service = new EpisodeBackfillService()
    const result = await service.backfill()

    expect(result.processed).toBe(1)
    expect(result.succeeded).toBe(1)
    expect(result.failed).toBe(0)

    const seasonRows = await db
      .select()
      .from(seasons)
      .where(eq(seasons.seriesId, canonicalSeries.id))
    expect(seasonRows).toHaveLength(1)
    expect(seasonRows[0].seasonNumber).toBe(1)

    const episodeRows = await db
      .select()
      .from(episodes)
      .where(eq(episodes.seriesId, canonicalSeries.id))
    expect(episodeRows).toHaveLength(2)

    const epAvRows = await db
      .select()
      .from(episodeAvailabilities)
      .where(eq(episodeAvailabilities.providerId, testSourceId))
    expect(epAvRows).toHaveLength(2)
    for (const row of epAvRows) {
      expect(row.status).toBe('AVAILABLE')
      expect(row.containerExtension).toBe('mkv')
    }
  })

  it('skips series that already have seasons when force is false', async () => {
    const [canonicalSeries] = await db
      .insert(seriesTable)
      .values({ title: 'Already Has Seasons', matchStatus: 'MATCHED' })
      .returning()

    await db.insert(seriesAvailabilities).values({
      seriesId: canonicalSeries.id,
      providerId: testSourceId,
      providerItemId: '2002',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: 'AVAILABLE',
    })

    await db.insert(seasons).values({ seriesId: canonicalSeries.id, seasonNumber: 1 })

    const getSeriesInfo = vi.fn().mockResolvedValue(makeSeriesInfo({ '1': [{ id: 'ep-2002-1', episode_num: 1, title: 'Ep1' }] }))
    MockedXtreamCodesClient.prototype.getSeriesInfo = getSeriesInfo

    const service = new EpisodeBackfillService()
    const result = await service.backfill({ force: false })

    expect(result.processed).toBe(0)
    expect(getSeriesInfo).not.toHaveBeenCalled()
  })

  it('processes series with existing seasons when force is true', async () => {
    const [canonicalSeries] = await db
      .insert(seriesTable)
      .values({ title: 'Force Series', matchStatus: 'MATCHED' })
      .returning()

    await db.insert(seriesAvailabilities).values({
      seriesId: canonicalSeries.id,
      providerId: testSourceId,
      providerItemId: '2003',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: 'AVAILABLE',
    })

    await db.insert(seasons).values({ seriesId: canonicalSeries.id, seasonNumber: 1 })

    MockedXtreamCodesClient.prototype.getSeriesInfo = vi.fn().mockResolvedValue(
      makeSeriesInfo({ '1': [{ id: 'ep-2003-1', episode_num: 1, title: 'Ep1' }] }),
    )

    const service = new EpisodeBackfillService()
    const result = await service.backfill({ force: true })

    expect(result.processed).toBe(1)
    expect(result.succeeded).toBe(1)
  })

  it('does not abort other series when getSeriesInfo fails for one', async () => {
    const [seriesA] = await db
      .insert(seriesTable)
      .values({ title: 'Series A', matchStatus: 'MATCHED' })
      .returning()
    const [seriesB] = await db
      .insert(seriesTable)
      .values({ title: 'Series B', matchStatus: 'MATCHED' })
      .returning()

    await db.insert(seriesAvailabilities).values([
      { seriesId: seriesA.id, providerId: testSourceId, providerItemId: '2004', firstSeenAt: new Date(), lastSeenAt: new Date(), status: 'AVAILABLE' },
      { seriesId: seriesB.id, providerId: testSourceId, providerItemId: '2005', firstSeenAt: new Date(), lastSeenAt: new Date(), status: 'AVAILABLE' },
    ])

    const infoA = makeSeriesInfo({ '1': [{ id: 'ep-2004-1', episode_num: 1, title: 'A Pilot' }] })
    let callCount = 0
    MockedXtreamCodesClient.prototype.getSeriesInfo = vi.fn().mockImplementation(async (id: number) => {
      callCount++
      if (id === 2005) throw new Error('network failure')
      return infoA
    })

    const service = new EpisodeBackfillService()
    const result = await service.backfill()

    expect(result.processed).toBe(2)
    expect(result.failed).toBe(1)

    // Series A episodes must have been created despite series B failure
    const epAvRows = await db
      .select()
      .from(episodeAvailabilities)
      .where(and(eq(episodeAvailabilities.providerId, testSourceId), eq(episodeAvailabilities.providerItemId, 'ep-2004-1')))
    expect(epAvRows).toHaveLength(1)
    expect(epAvRows[0].status).toBe('AVAILABLE')

    // Existing series B availability must NOT be marked UNAVAILABLE
    const [bAv] = await db
      .select()
      .from(seriesAvailabilities)
      .where(and(eq(seriesAvailabilities.providerId, testSourceId), eq(seriesAvailabilities.providerItemId, '2005')))
    expect(bAv.status).toBe('AVAILABLE')
  })

  it('getLatestState returns null before any run', () => {
    const service = new EpisodeBackfillService()
    expect(service.getLatestState()).toBeNull()
  })

  it('getLatestState reflects result after backfill completes', async () => {
    const [canonicalSeries] = await db
      .insert(seriesTable)
      .values({ title: 'State Test Series', matchStatus: 'MATCHED' })
      .returning()

    await db.insert(seriesAvailabilities).values({
      seriesId: canonicalSeries.id,
      providerId: testSourceId,
      providerItemId: '2006',
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      status: 'AVAILABLE',
    })

    MockedXtreamCodesClient.prototype.getSeriesInfo = vi.fn().mockResolvedValue(
      makeSeriesInfo({ '1': [{ id: 'ep-2006-1', episode_num: 1, title: 'Ep1' }] }),
    )

    const service = new EpisodeBackfillService()
    await service.backfill()

    const state = service.getLatestState()
    expect(state).not.toBeNull()
    expect(state!.processed).toBe(1)
    expect(state!.completedAt).toBeInstanceOf(Date)
  })
})
