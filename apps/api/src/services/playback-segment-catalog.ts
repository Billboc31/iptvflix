import { eq, gt, and, sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { playbackSegmentResponses, playbackSegmentCatalog } from '../db/schema/playback-segment-cache.js'
import { configureSegmentResponseCache, lookupPlaybackSegments, segmentRequestCount } from './playback-segments.js'

const DAY = 86400_000
export function configurePersistentSegmentCache(): void {
  configureSegmentResponseCache({
    async get(url) {
      const [row] = await db.select().from(playbackSegmentResponses).where(and(eq(playbackSegmentResponses.url, url), gt(playbackSegmentResponses.fetchedAt, new Date(Date.now() - DAY)))).limit(1)
      return row?.payload
    },
    async set(url, payload) {
      await db.insert(playbackSegmentResponses).values({ url, payload, fetchedAt: new Date() }).onConflictDoUpdate({ target: playbackSegmentResponses.url, set: { payload, fetchedAt: new Date() } })
    },
  })
}

let running = false
let stopped = false
let timer: ReturnType<typeof setTimeout> | undefined
/** A database advisory lock keeps simultaneous Railway instances from running the same batch. */
export async function refreshPlaybackSegmentBatch(): Promise<number> {
  if (running || process.env.PLAYBACK_SEGMENTS_ENABLED === 'false') return 0
  running = true
  try {
    return await db.transaction(async tx => {
      const lock = await tx.execute(sql`select pg_try_advisory_xact_lock(79532157) as acquired`)
      if (!lock[0]?.acquired) return 0
      const rows = await tx.execute(sql`
        with season_offsets as (
          select id, sum(episode_count) over w as prior_episodes, count(*) over w as prior_seasons,
            count(*) filter (where coalesce(episode_count,0)<=0) over w as invalid
          from seasons where season_number>0
          window w as (partition by series_id order by season_number rows between unbounded preceding and 1 preceding)
        ), catalog as (
          select 'movie'::text as media_type, m.id, m.tmdb_id, coalesce(m.imdb_id,m.external_ids->>'imdb_id') as imdb_id, 0 as season_number, 0 as episode_number, null::bigint as absolute_episode_number
          from movies m
          union all
          select 'episode'::text, e.id, s.tmdb_id, coalesce(s.imdb_id,s.external_ids->>'imdb_id'), sn.season_number, e.episode_number,
            case when o.prior_seasons=sn.season_number-1 and o.invalid=0 then coalesce(o.prior_episodes,0)+e.episode_number end
          from episodes e join series s on s.id=e.series_id join seasons sn on sn.id=e.season_id left join season_offsets o on o.id=sn.id
        )
        select c.* from catalog c left join playback_segment_catalog p on p.media_type=c.media_type and p.media_id=c.id
        where p.media_id is null or p.retry_at <= now()
        order by p.checked_at asc nulls first, c.media_type, c.id limit 100`)
      for (const row of rows) {
        if (stopped) break
        const mediaType = row.media_type as 'movie' | 'episode'
        const mediaId = String(row.id)
        const absoluteEpisodeNumber = row.absolute_episode_number == null ? undefined : Number(row.absolute_episode_number)
        const beforeRequests = segmentRequestCount()
        try {
          const segments = await lookupPlaybackSegments({ catalog: true, mediaType, episodeId: mediaId, seriesTmdbId: row.tmdb_id == null ? null : Number(row.tmdb_id), seriesImdbId: row.imdb_id == null ? null : String(row.imdb_id), seasonNumber: Number(row.season_number), episodeNumber: Number(row.episode_number), absoluteEpisodeNumber })
          const values = { mediaType, mediaId, segments, checkedAt: new Date(), retryAt: new Date(Date.now() + DAY), lastError: null }
          await tx.insert(playbackSegmentCatalog).values(values).onConflictDoUpdate({ target: [playbackSegmentCatalog.mediaType, playbackSegmentCatalog.mediaId], set: values })
        } catch {
          const values = { mediaType, mediaId, checkedAt: new Date(), retryAt: new Date(Date.now() + 3600_000), lastError: 'Provider lookup failed; retry scheduled' }
          // Keep the last known segments on transient failure.
          await tx.insert(playbackSegmentCatalog).values(values).onConflictDoUpdate({ target: [playbackSegmentCatalog.mediaType, playbackSegmentCatalog.mediaId], set: values })
        }
        if (segmentRequestCount() > beforeRequests) await new Promise(resolve => setTimeout(resolve, 750))
      }
      return rows.length
    })
  } finally { running = false }
}

export function startPlaybackSegmentRefresh(): void {
  if (process.env.PLAYBACK_SEGMENTS_ENABLED === 'false' || process.env.PLAYBACK_SEGMENT_CATALOG_ENABLED === 'false') return
  stopped = false
  const tick = async () => {
    let count = 0
    try { count = await refreshPlaybackSegmentBatch() } catch (error) { console.error('[playback-segment-catalog] batch failed', error instanceof Error ? error.message : 'unknown') }
    if (!stopped) { timer = setTimeout(() => void tick(), count ? 1000 : 60_000); timer.unref() }
  }
  timer = setTimeout(() => void tick(), 30_000)
  timer.unref()
}
export function stopPlaybackSegmentRefresh(): void { stopped = true; if (timer) clearTimeout(timer) }
