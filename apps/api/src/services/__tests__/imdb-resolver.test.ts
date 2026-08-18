import 'dotenv/config'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../../db/client.js'
import { series as seriesTable } from '../../db/schema/series.js'
import { resolveAndPersistSeriesImdbId } from '../imdb-resolver.js'
import type { TmdbClient } from '../../providers/metadata/tmdb/client.js'

const T_TMDB_SERIES = 9_600_002

function makeTmdbClient(imdbId: string | null): Pick<TmdbClient, 'getSeriesExternalIds'> {
  return {
    getSeriesExternalIds: vi.fn().mockResolvedValue({ imdb_id: imdbId }),
  }
}

let testSeriesId: string

beforeEach(async () => {
  const [ser] = await db
    .insert(seriesTable)
    .values({ title: 'IMDb Resolver Test Series', tmdbId: T_TMDB_SERIES })
    .returning({ id: seriesTable.id })
  testSeriesId = ser.id
})

afterEach(async () => {
  await db.delete(seriesTable).where(eq(seriesTable.id, testSeriesId))
})

describe('resolveAndPersistSeriesImdbId()', () => {
  it('returns existing imdbId without calling TMDB when already populated', async () => {
    await db.update(seriesTable).set({ imdbId: 'tt1234567' }).where(eq(seriesTable.id, testSeriesId))
    const tmdb = makeTmdbClient('tt9999999')

    const result = await resolveAndPersistSeriesImdbId(db, tmdb as unknown as TmdbClient, testSeriesId)

    expect(result).toBe('tt1234567')
    expect(tmdb.getSeriesExternalIds).not.toHaveBeenCalled()
  })

  it('fetches from TMDB and persists imdbId when absent', async () => {
    const tmdb = makeTmdbClient('tt0816692')

    const result = await resolveAndPersistSeriesImdbId(db, tmdb as unknown as TmdbClient, testSeriesId)

    expect(result).toBe('tt0816692')
    expect(tmdb.getSeriesExternalIds).toHaveBeenCalledWith(T_TMDB_SERIES)

    const [row] = await db.select({ imdbId: seriesTable.imdbId }).from(seriesTable).where(eq(seriesTable.id, testSeriesId))
    expect(row.imdbId).toBe('tt0816692')
  })

  it('returns null when TMDB returns no imdbId', async () => {
    const tmdb = makeTmdbClient(null)

    const result = await resolveAndPersistSeriesImdbId(db, tmdb as unknown as TmdbClient, testSeriesId)

    expect(result).toBeNull()
  })

  it('returns null when series has no tmdbId', async () => {
    const [noTmdbSeries] = await db
      .insert(seriesTable)
      .values({ title: 'No TMDB Series' })
      .returning({ id: seriesTable.id })
    const tmdb = makeTmdbClient('tt1111111')

    const result = await resolveAndPersistSeriesImdbId(db, tmdb as unknown as TmdbClient, noTmdbSeries.id)

    expect(result).toBeNull()
    await db.delete(seriesTable).where(eq(seriesTable.id, noTmdbSeries.id))
  })

  it('returns null when seriesId does not exist', async () => {
    const tmdb = makeTmdbClient('tt1111111')
    const result = await resolveAndPersistSeriesImdbId(db, tmdb as unknown as TmdbClient, '00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
})
