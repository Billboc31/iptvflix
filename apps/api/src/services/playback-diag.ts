import { readdir } from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movieAvailabilities, episodeAvailabilities } from '../db/schema/availabilities.js'
import { sources } from '../db/schema/sources.js'
import {
  buildXtreamMovieUrl,
  buildXtreamEpisodeUrl,
  resolveXtreamFetchTarget,
  XTREAM_STREAM_HEADERS,
} from '../providers/xtream/playback.js'
import { getProbe } from './probe-cache.js'
import { isFfmpegAvailable, isFfprobeAvailable } from './ffmpeg-availability.js'
import { findSessionByAvailabilityId } from './playback-session-store.js'
import { getHlsSession, SEGMENT_RE } from './hls-session-store.js'

export type PlaybackDiagResult = {
  availabilityId: string
  upstreamReachable: boolean | null
  upstreamHttpStatus: number | null
  upstreamContentType: string | null
  upstreamIsMediaBody: boolean | null
  upstreamRedirectFinalUrl: string | null
  detectedContainer: string | null
  detectedVideoCodec: string | null
  detectedAudioCodec: string | null
  deliveryMode: string | null
  ffmpegAvailable: boolean
  ffprobeAvailable: boolean
  sessionActive: boolean
  sessionId: string | null
  manifestReady: boolean | null
  segmentCount: number | null
  lastFfmpegError: string | null
}

type AvailRow = {
  id: string
  providerId: string
  providerItemId: string
  containerExtension: string | null
}

/** Returns diagnostic info for a given availabilityId. Returns null if not found. */
export async function getPlaybackDiag(availabilityId: string): Promise<PlaybackDiagResult | null> {
  let avail: AvailRow | null = null
  let mediaType: 'movie' | 'episode' = 'movie'

  const [movieRow] = await db
    .select({
      id: movieAvailabilities.id,
      providerId: movieAvailabilities.providerId,
      providerItemId: movieAvailabilities.providerItemId,
      containerExtension: movieAvailabilities.containerExtension,
    })
    .from(movieAvailabilities)
    .where(eq(movieAvailabilities.id, availabilityId))
    .limit(1)

  if (movieRow) {
    avail = movieRow
    mediaType = 'movie'
  } else {
    const [episodeRow] = await db
      .select({
        id: episodeAvailabilities.id,
        providerId: episodeAvailabilities.providerId,
        providerItemId: episodeAvailabilities.providerItemId,
        containerExtension: episodeAvailabilities.containerExtension,
      })
      .from(episodeAvailabilities)
      .where(eq(episodeAvailabilities.id, availabilityId))
      .limit(1)
    if (episodeRow) {
      avail = episodeRow
      mediaType = 'episode'
    }
  }

  if (!avail) return null

  const [source] = await db
    .select()
    .from(sources)
    .where(eq(sources.id, avail.providerId))
    .limit(1)

  if (!source) return null

  // Build upstream URL server-side (never returned to client)
  let upstreamUrl: string | null = null
  if (source.type === 'XTREAM' && source.username && source.password) {
    if (mediaType === 'movie') {
      upstreamUrl = buildXtreamMovieUrl(
        source.baseUrl,
        source.username,
        source.password,
        avail.providerItemId,
        avail.containerExtension,
      )
    } else {
      upstreamUrl = buildXtreamEpisodeUrl(
        source.baseUrl,
        source.username,
        source.password,
        avail.providerItemId,
        avail.containerExtension,
      )
    }
  }

  // Check upstream reachability (3-second timeout HEAD-with-Range request)
  let upstreamReachable: boolean | null = null
  let upstreamHttpStatus: number | null = null
  let upstreamContentType: string | null = null
  let upstreamIsMediaBody: boolean | null = null
  let upstreamRedirectFinalUrl: string | null = null
  if (upstreamUrl) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3_000)
    try {
      const target = await resolveXtreamFetchTarget(upstreamUrl)
      const res = await fetch(target.href, {
        method: 'GET',
        headers: { ...XTREAM_STREAM_HEADERS, ...target.extraHeaders, Range: 'bytes=0-0' },
        signal: controller.signal,
        redirect: 'follow',
      })
      clearTimeout(timer)
      upstreamHttpStatus = res.status
      upstreamReachable = res.ok || res.status === 206
      upstreamContentType = res.headers.get('content-type')
      upstreamIsMediaBody =
        upstreamContentType !== null &&
        (upstreamContentType.startsWith('video/') ||
          upstreamContentType.startsWith('application/octet-stream') ||
          upstreamContentType.startsWith('application/vnd.apple.mpegurl') ||
          upstreamContentType.startsWith('application/x-mpegurl'))
      // Mask provider credentials from the final URL (after redirects)
      let finalUrl = res.url
      if (source.username && source.username.length > 0) finalUrl = finalUrl.replaceAll(source.username, '[REDACTED]')
      if (source.password && source.password.length > 0) finalUrl = finalUrl.replaceAll(source.password, '[REDACTED]')
      upstreamRedirectFinalUrl = finalUrl
      // Consume body to free resources
      if (res.body) {
        try { await res.body.cancel() } catch { /* ignore */ }
      }
    } catch {
      clearTimeout(timer)
      upstreamReachable = false
    }
  }

  // Cached probe result (never includes credentials)
  const cached = getProbe(availabilityId)

  // Binary availability
  const [ffmpegAvail, ffprobeAvail] = await Promise.all([
    isFfmpegAvailable(),
    isFfprobeAvailable(),
  ])

  // Active playback session and HLS state
  const activeSession = findSessionByAvailabilityId(availabilityId)
  let manifestReady: boolean | null = null
  let segmentCount: number | null = null
  let lastFfmpegError: string | null = null

  if (activeSession) {
    const hlsEntry = getHlsSession(activeSession.sessionId)
    if (hlsEntry) {
      manifestReady = !hlsEntry.failed
      lastFfmpegError = hlsEntry.failedReason ?? null
      try {
        const files = await readdir(hlsEntry.tempDir)
        segmentCount = files.filter((f) => SEGMENT_RE.test(f)).length
      } catch {
        segmentCount = null
      }
    }
  }

  return {
    availabilityId,
    upstreamReachable,
    upstreamHttpStatus,
    upstreamContentType,
    upstreamIsMediaBody,
    upstreamRedirectFinalUrl,
    detectedContainer: cached?.containerFormat ?? null,
    detectedVideoCodec: cached?.videoCodec ?? null,
    detectedAudioCodec: cached?.audioCodec ?? null,
    deliveryMode: activeSession?.deliveryMode ?? null,
    ffmpegAvailable: ffmpegAvail,
    ffprobeAvailable: ffprobeAvail,
    sessionActive: !!activeSession,
    sessionId: activeSession?.sessionId ?? null,
    manifestReady,
    segmentCount,
    lastFfmpegError,
  }
}
