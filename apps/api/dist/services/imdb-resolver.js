import { eq } from 'drizzle-orm';
import { series } from '../db/schema/series.js';
export async function resolveAndPersistSeriesImdbId(db, tmdbClient, seriesId) {
    const [row] = await db.select({ imdbId: series.imdbId, tmdbId: series.tmdbId }).from(series).where(eq(series.id, seriesId)).limit(1);
    if (!row)
        return null;
    if (row.imdbId)
        return row.imdbId;
    if (!row.tmdbId)
        return null;
    const externalIds = await tmdbClient.getSeriesExternalIds(row.tmdbId);
    const imdbId = externalIds.imdb_id ?? null;
    if (!imdbId)
        return null;
    await db.update(series).set({ imdbId }).where(eq(series.id, seriesId));
    return imdbId;
}
//# sourceMappingURL=imdb-resolver.js.map