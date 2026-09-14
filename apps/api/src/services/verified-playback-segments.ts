import type { EpisodeSegmentItem } from '@iptvflix/api-contracts'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { episodeAvailabilities, verifiedPlaybackSegments } from '../db/schema/index.js'
export type VerifiedSegment = { type: EpisodeSegmentItem['type']; durationMs: number; startMs: number; endMs: number }
export function matchVerifiedSegments(rows: VerifiedSegment[], durationSeconds?: number): EpisodeSegmentItem[] {
  if (!durationSeconds || !Number.isFinite(durationSeconds)) return []
  const durationMs = Math.round(durationSeconds * 1000)
  return rows.filter(r => Math.abs(r.durationMs - durationMs) <= 500 &&
    r.startMs >= 0 && r.endMs > r.startMs && r.endMs <= r.durationMs && r.startMs < durationMs)
    .map(r => ({ type: r.type, startMs: r.startMs, endMs: Math.min(r.endMs, durationMs), autoSkipSafe: true, source: 'IPTVFlix vérifié' }))
}
export async function getVerifiedEpisodeSegments(episodeId: string, availabilityId?: string, durationSeconds?: number): Promise<EpisodeSegmentItem[]> {
  if (!availabilityId || !durationSeconds) return []
  const rows = await db.select({ type: verifiedPlaybackSegments.type, durationMs: verifiedPlaybackSegments.durationMs,
    startMs: verifiedPlaybackSegments.startMs, endMs: verifiedPlaybackSegments.endMs })
    .from(verifiedPlaybackSegments).innerJoin(episodeAvailabilities, eq(episodeAvailabilities.id, verifiedPlaybackSegments.availabilityId))
    .where(and(eq(verifiedPlaybackSegments.availabilityId, availabilityId), eq(episodeAvailabilities.episodeId, episodeId), eq(episodeAvailabilities.status, 'AVAILABLE')))
  return matchVerifiedSegments(rows, durationSeconds)
}
export function mergeVerifiedSegments(online: EpisodeSegmentItem[], verified: EpisodeSegmentItem[]): EpisodeSegmentItem[] {
  const normalized = (type: string) => type === 'OUTRO' ? 'CREDITS' : type
  return [...online.filter(s => !verified.some(v => normalized(v.type) === normalized(s.type))), ...verified].sort((a, b) => a.startMs - b.startMs)
}
