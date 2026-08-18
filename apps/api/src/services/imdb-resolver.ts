import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type * as schema from '../db/schema/index.js'
import { series } from '../db/schema/series.js'
import type { TmdbClient } from '../providers/metadata/tmdb/client.js'

type Db = PostgresJsDatabase<typeof schema>

export async function resolveAndPersistSeriesImdbId(
  db: Db,
  tmdbClient: TmdbClient,
  seriesId: string,
): Promise<string | null> {
  const [row] = await db.select({ imdbId: series.imdbId, tmdbId: series.tmdbId }).from(series).where(eq(series.id, seriesId)).limit(1)
  if (!row) return null
  if (row.imdbId) return row.imdbId

  if (!row.tmdbId) return null

  const externalIds = await tmdbClient.getSeriesExternalIds(row.tmdbId)
  const imdbId = externalIds.imdb_id ?? null
  if (!imdbId) return null

  await db.update(series).set({ imdbId }).where(eq(series.id, seriesId))
  return imdbId
}
