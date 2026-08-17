import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movieAvailabilities, episodeAvailabilities } from '../db/schema/availabilities.js'
import { sources } from '../db/schema/sources.js'
import { viewingProgress } from '../db/schema/viewing-progress.js'
import { buildXtreamMovieUrl, buildXtreamEpisodeUrl, browserSafeXtreamUrl } from '../providers/xtream/playback.js'
import { buildM3UStreamUrl } from '../providers/m3u/playback.js'
import { resolveVariant } from './availability-resolver.js'
import { getDefaultProfilePreferences } from './profile-service.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js'
import { createSession, patchSession } from './playback-session-store.js'
import { probeMedia } from './media-prober.js'
import { getProbe, setProbe } from './probe-cache.js'
import { classifyDelivery } from './playback-compat.js'
import { createHlsSession, waitForPlaylist } from './hls-session-store.js'
import { isFfmpegAvailable } from './ffmpeg-availability.js'
import type { PlaybackSessionResponse, AvailabilityVariantResponse } from '@iptvflix/api-contracts'
import type { DeliveryMode } from './playback-compat.js'
import type { MediaInfo } from './media-prober.js'

export type PlaybackMediaType = 'movie' | 'episode'

type AvailabilityRow = {
  id: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  providerId: string
  providerItemId: string
  audioLanguage: string | null
  subtitleLanguage: string | null
  videoQuality: string | null
  rawTitle: string | null
  containerExtension: string | null
}

async function fetchAvailabilities(mediaType: PlaybackMediaType, mediaId: string): Promise<AvailabilityRow[]> {
  if (mediaType === 'movie') {
    return db
      .select({
        id: movieAvailabilities.id,
        status: movieAvailabilities.status,
        providerId: movieAvailabilities.providerId,
        providerItemId: movieAvailabilities.providerItemId,
        audioLanguage: movieAvailabilities.audioLanguage,
        subtitleLanguage: movieAvailabilities.subtitleLanguage,
        videoQuality: movieAvailabilities.videoQuality,
        rawTitle: movieAvailabilities.rawTitle,
        containerExtension: movieAvailabilities.containerExtension,
      })
      .from(movieAvailabilities)
      .where(eq(movieAvailabilities.movieId, mediaId))
  }
  return db
    .select({
      id: episodeAvailabilities.id,
      status: episodeAvailabilities.status,
      providerId: episodeAvailabilities.providerId,
      providerItemId: episodeAvailabilities.providerItemId,
      audioLanguage: episodeAvailabilities.audioLanguage,
      subtitleLanguage: episodeAvailabilities.subtitleLanguage,
      videoQuality: episodeAvailabilities.videoQuality,
      rawTitle: episodeAvailabilities.rawTitle,
      containerExtension: episodeAvailabilities.containerExtension,
    })
    .from(episodeAvailabilities)
    .where(eq(episodeAvailabilities.episodeId, mediaId))
}

async function fetchProgress(profileId: string, mediaType: PlaybackMediaType, mediaId: string): Promise<number> {
  const pgMediaType = mediaType === 'movie' ? 'MOVIE' : 'EPISODE'
  const [row] = await db
    .select({ progressSeconds: viewingProgress.progressSeconds })
    .from(viewingProgress)
    .where(
      and(
        eq(viewingProgress.profileId, profileId),
        eq(viewingProgress.mediaType, pgMediaType),
        eq(viewingProgress.mediaId, mediaId),
      ),
    )
  return row?.progressSeconds ?? 0
}

// Derive delivery mode from container extension when probing is unavailable.
// Keeps the path working even when ffprobe cannot reach the upstream URL.
function extensionFallbackMode(containerExtension: string): DeliveryMode {
  const ext = containerExtension.toLowerCase()
  if (ext === 'm3u8' || ext === 'm3u') return 'DIRECT'
  if (ext === 'ts' || ext === 'mkv' || ext === 'avi' || ext === 'flv' || ext === 'wmv') return 'HLS_REMUX'
  // mp4/m4v without a probe result cannot be trusted as browser-compatible (may be HEVC)
  return 'HLS_TRANSCODE_FULL'
}

export async function resolvePlayback(
  profileId: string,
  mediaType: PlaybackMediaType,
  mediaId: string,
  explicitAvailabilityId?: string,
  correlationId = 'unknown',
): Promise<PlaybackSessionResponse> {
  const t0 = Date.now()
  console.info({ correlationId, step: 'resolve_start', mediaType, mediaId }, 'playback-resolver: resolve_start')

  const [allRows, prefs] = await Promise.all([
    fetchAvailabilities(mediaType, mediaId),
    getDefaultProfilePreferences(),
  ])

  const providerIds = [...new Set(allRows.map((r) => r.providerId))]
  const sourceRows = providerIds.length > 0
    ? await db.select().from(sources).where(inArray(sources.id, providerIds))
    : []

  const sourceMap = new Map(sourceRows.map((s) => [s.id, s]))

  const candidates = allRows.filter(
    (r) => r.status === 'AVAILABLE' && sourceMap.get(r.providerId)?.enabled === true,
  )

  let selectedId: string

  if (explicitAvailabilityId !== undefined) {
    const explicit = allRows.find((r) => r.id === explicitAvailabilityId)
    if (!explicit) {
      throw new NotFoundError('Availability', explicitAvailabilityId)
    }
    if (explicit.status !== 'AVAILABLE') {
      throw new ValidationError('Variant not available')
    }
    const src = sourceMap.get(explicit.providerId)
    if (!src || !src.enabled) {
      throw new ForbiddenError('Variant not available')
    }
    selectedId = explicitAvailabilityId
  } else {
    const resolvable = candidates.map((r) => ({
      id: r.id,
      status: r.status as 'AVAILABLE' | 'UNAVAILABLE',
      providerId: r.providerId,
      audioLanguage: r.audioLanguage,
      subtitleLanguage: r.subtitleLanguage,
      videoQuality: r.videoQuality,
      containerExtension: r.containerExtension,
      // Use cached codec info for compatibility scoring if available
      videoCodec: getProbe(r.id)?.videoCodec ?? null,
    }))
    const { selectedVariantId } = resolveVariant(resolvable, prefs)
    if (!selectedVariantId) {
      throw new ValidationError('Variant not available')
    }
    selectedId = selectedVariantId
  }

  const selected = candidates.find((r) => r.id === selectedId)!
  const source = sourceMap.get(selected.providerId)!

  console.info({
    correlationId,
    step: 'availability_fetched',
    availabilityId: selectedId,
    sourceId: selected.providerId,
    sourceType: source.type,
    containerExtension: selected.containerExtension,
    durationMs: Date.now() - t0,
  }, 'playback-resolver: availability_fetched')

  const startPositionSeconds = await fetchProgress(profileId, mediaType, mediaId)

  let providerStreamUrl: string
  // Use the catalog extension. Forcing .m3u8 broke this panel (HTTP 551);
  // residential probes showed .mkv/.mp4 as the working shapes.
  let containerExtension = selected.containerExtension ?? 'ts'
  if (source.type === 'XTREAM') {
    // Proxying from Railway is blocked by Cloudflare (403). Redirect the
    // browser to the provider URL so the request uses the viewer network.
    if (mediaType === 'movie') {
      providerStreamUrl = buildXtreamMovieUrl(
        source.baseUrl,
        source.username ?? '',
        source.password ?? '',
        selected.providerItemId,
        containerExtension,
      )
    } else {
      providerStreamUrl = buildXtreamEpisodeUrl(
        source.baseUrl,
        source.username ?? '',
        source.password ?? '',
        selected.providerItemId,
        containerExtension,
      )
    }
    providerStreamUrl = browserSafeXtreamUrl(providerStreamUrl)
  } else if (source.type === 'M3U') {
    providerStreamUrl = buildM3UStreamUrl(selected.providerItemId)
  } else {
    console.error('playback-resolver: unknown source type', {
      correlationId,
      mediaType,
      mediaId,
      availabilityId: selected.id,
      sourceId: selected.providerId,
      containerExtension: selected.containerExtension,
    })
    throw new ValidationError('Variant not available')
  }

  console.info({
    correlationId,
    step: 'upstream_url_built',
    containerExtension,
    durationMs: Date.now() - t0,
  }, 'playback-resolver: upstream_url_built')

  // Probe media to determine browser-compatible delivery mode.
  // On probe failure, use extension-based fallback classification.
  let probeResult: MediaInfo | null = null
  let deliveryMode: DeliveryMode

  const cached = getProbe(selectedId)
  if (source.type === 'XTREAM') {
    probeResult = null
    deliveryMode = 'DIRECT'
    console.info({
      correlationId,
      step: 'probe_result',
      skipped: true,
      reason: 'xtream_always_direct',
      durationMs: Date.now() - t0,
    }, 'playback-resolver: probe_result')
  } else if (cached) {
    probeResult = cached
    deliveryMode = classifyDelivery(cached)
    console.info({
      correlationId,
      step: 'probe_result',
      source: 'cache',
      videoCodec: cached.videoCodec,
      audioCodec: cached.audioCodec,
      containerFormat: cached.containerFormat,
      durationMs: Date.now() - t0,
    }, 'playback-resolver: probe_result')
  } else {
    try {
      probeResult = await probeMedia(providerStreamUrl)
      setProbe(selectedId, probeResult)
      deliveryMode = classifyDelivery(probeResult)
      console.info({
        correlationId,
        step: 'probe_result',
        source: 'fresh',
        videoCodec: probeResult.videoCodec,
        audioCodec: probeResult.audioCodec,
        containerFormat: probeResult.containerFormat,
        durationMs: Date.now() - t0,
      }, 'playback-resolver: probe_result')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn({
        correlationId,
        step: 'probe_result',
        source: 'failed',
        probeError: errMsg,
        fallbackMode: extensionFallbackMode(containerExtension),
        durationMs: Date.now() - t0,
      }, 'playback-resolver: probe failed, using extension fallback')
      deliveryMode = extensionFallbackMode(containerExtension)
    }
  }

  // Without ffmpeg, HLS remux/transcode cannot run — fall back to direct proxy.
  if (deliveryMode !== 'DIRECT' && !(await isFfmpegAvailable())) {
    console.warn({
      correlationId,
      step: 'delivery_mode_selected',
      requestedMode: deliveryMode,
      finalMode: 'DIRECT',
      reason: 'ffmpeg_unavailable',
      durationMs: Date.now() - t0,
    }, 'playback-resolver: ffmpeg unavailable, falling back to DIRECT')
    deliveryMode = 'DIRECT'
  }

  console.info({
    correlationId,
    step: 'delivery_mode_selected',
    deliveryMode,
    containerExtension,
    durationMs: Date.now() - t0,
  }, 'playback-resolver: delivery_mode_selected')

  const sessionId = createSession({
    profileId,
    mediaType,
    mediaId,
    availabilityId: selectedId,
    sourceId: selected.providerId,
    providerStreamUrl,
    containerExtension,
    deliveryMode,
    correlationId,
  })

  console.info({
    correlationId,
    step: 'session_created',
    sessionId,
    mediaType,
    mediaId,
    availabilityId: selectedId,
    sourceId: selected.providerId,
    containerExtension,
    deliveryMode,
    probeVideoCodec: probeResult?.videoCodec ?? null,
    probeAudioCodec: probeResult?.audioCodec ?? null,
    probeContainerFormat: probeResult?.containerFormat ?? null,
    durationMs: Date.now() - t0,
  }, 'playback-resolver: session_created')

  const alternatives: AvailabilityVariantResponse[] = candidates
    .filter((r) => r.id !== selectedId)
    .map((r) => ({
      id: r.id,
      status: r.status,
      providerId: r.providerId,
      audioLanguage: r.audioLanguage,
      subtitleLanguage: r.subtitleLanguage,
      videoQuality: r.videoQuality,
      rawTitle: r.rawTitle,
    }))

  // HLS modes: spawn ffmpeg pipeline and return playlist URL.
  // If ffmpeg cannot produce a playlist, fall back to DIRECT so the player
  // still gets a usable gateway instead of a 410 "session expired".
  if (deliveryMode !== 'DIRECT') {
    try {
      await createHlsSession(sessionId, providerStreamUrl, deliveryMode)
      const playlistReady = await waitForPlaylist(sessionId, 15_000)
      if (playlistReady) {
        const gatewayUrl = `/playback/session/${sessionId}/master.m3u8`
        console.info({
          correlationId,
          step: 'gateway_url_issued',
          sessionId,
          gatewayUrl,
          deliveryMode,
          durationMs: Date.now() - t0,
        }, 'playback-resolver: gateway_url_issued')
        return {
          gatewayUrl,
          deliveryMode,
          probeResult,
          containerExtension,
          availabilityId: selectedId,
          startPositionSeconds,
          alternatives,
          correlationId,
        }
      }
      console.warn({
        correlationId,
        step: 'hls_not_ready',
        sessionId,
        requestedMode: deliveryMode,
        containerExtension,
        durationMs: Date.now() - t0,
      }, 'playback-resolver: HLS playlist never became ready, falling back to DIRECT')
      patchSession(sessionId, { deliveryMode: 'DIRECT' })
      deliveryMode = 'DIRECT'
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error({
        correlationId,
        step: 'hls_creation_failed',
        sessionId,
        deliveryMode,
        error: errMsg,
        durationMs: Date.now() - t0,
      }, 'playback-resolver: HLS session creation failed')
      patchSession(sessionId, { deliveryMode: 'DIRECT' })
      deliveryMode = 'DIRECT'
    }
  }

  const gatewayUrl = `/playback/stream/${sessionId}`
  console.info({
    correlationId,
    step: 'gateway_url_issued',
    sessionId,
    gatewayUrl,
    deliveryMode,
    durationMs: Date.now() - t0,
  }, 'playback-resolver: gateway_url_issued')
  return {
    gatewayUrl,
    deliveryMode,
    probeResult,
    containerExtension,
    availabilityId: selectedId,
    startPositionSeconds,
    alternatives,
    correlationId,
  }
}
