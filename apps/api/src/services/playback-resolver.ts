import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../db/client.js'
import { movieAvailabilities, episodeAvailabilities } from '../db/schema/availabilities.js'
import { sources } from '../db/schema/sources.js'
import { viewingProgress } from '../db/schema/viewing-progress.js'
import { buildXtreamMovieUrl, buildXtreamEpisodeUrl } from '../providers/xtream/playback.js'
import { buildM3UStreamUrl } from '../providers/m3u/playback.js'
import { resolveVariant } from './availability-resolver.js'
import { getDefaultProfilePreferences } from './profile-service.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js'
import { createSession } from './playback-session-store.js'
import { probeMedia } from './media-prober.js'
import { getProbe, setProbe } from './probe-cache.js'
import { classifyDelivery } from './playback-compat.js'
import { createHlsSession } from './hls-session-store.js'
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
  if (ext === 'mp4' || ext === 'm4v') return 'DIRECT'
  if (ext === 'm3u8' || ext === 'm3u') return 'DIRECT'
  if (ext === 'ts' || ext === 'mkv' || ext === 'avi' || ext === 'flv' || ext === 'wmv') return 'HLS_REMUX'
  return 'HLS_TRANSCODE_FULL'
}

export async function resolvePlayback(
  profileId: string,
  mediaType: PlaybackMediaType,
  mediaId: string,
  explicitAvailabilityId?: string,
): Promise<PlaybackSessionResponse> {
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

  const startPositionSeconds = await fetchProgress(profileId, mediaType, mediaId)

  let providerStreamUrl: string
  if (source.type === 'XTREAM') {
    if (mediaType === 'movie') {
      providerStreamUrl = buildXtreamMovieUrl(
        source.baseUrl,
        source.username ?? '',
        source.password ?? '',
        selected.providerItemId,
        selected.containerExtension,
      )
    } else {
      providerStreamUrl = buildXtreamEpisodeUrl(
        source.baseUrl,
        source.username ?? '',
        source.password ?? '',
        selected.providerItemId,
        selected.containerExtension,
      )
    }
  } else if (source.type === 'M3U') {
    providerStreamUrl = buildM3UStreamUrl(selected.providerItemId)
  } else {
    console.error('playback-resolver: unknown source type', {
      mediaType,
      mediaId,
      availabilityId: selected.id,
      sourceId: selected.providerId,
      containerExtension: selected.containerExtension,
    })
    throw new ValidationError('Variant not available')
  }

  const containerExtension = selected.containerExtension ?? 'ts'

  // Probe media to determine browser-compatible delivery mode.
  // On probe failure, use extension-based fallback classification.
  let probeResult: MediaInfo | null = null
  let deliveryMode: DeliveryMode

  const cached = getProbe(selectedId)
  if (cached) {
    probeResult = cached
    deliveryMode = classifyDelivery(cached)
  } else {
    try {
      probeResult = await probeMedia(providerStreamUrl)
      setProbe(selectedId, probeResult)
      deliveryMode = classifyDelivery(probeResult)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.warn('playback-resolver: probe failed, using extension fallback', {
        mediaType,
        mediaId,
        availabilityId: selectedId,
        sourceId: selected.providerId,
        containerExtension,
        probeError: errMsg,
      })
      deliveryMode = extensionFallbackMode(containerExtension)
    }
  }

  const sessionId = createSession({
    profileId,
    mediaType,
    mediaId,
    availabilityId: selectedId,
    sourceId: selected.providerId,
    providerStreamUrl,
    containerExtension,
    deliveryMode,
  })

  console.info('playback-resolver: session created', {
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
  })

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

  // HLS modes: spawn ffmpeg pipeline and return playlist URL
  if (deliveryMode !== 'DIRECT') {
    try {
      await createHlsSession(sessionId, providerStreamUrl, deliveryMode)
      console.info('playback-resolver: HLS session created', {
        sessionId,
        ffmpegMode: deliveryMode,
      })
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error('playback-resolver: HLS session creation failed', {
        sessionId,
        deliveryMode,
        error: errMsg,
      })
      throw new ValidationError('Variant not available')
    }

    const gatewayUrl = `/api/playback/session/${sessionId}/master.m3u8`
    return {
      gatewayUrl,
      deliveryMode,
      probeResult,
      containerExtension,
      availabilityId: selectedId,
      startPositionSeconds,
      alternatives,
    }
  }

  const gatewayUrl = `/api/playback/stream/${sessionId}`
  return {
    gatewayUrl,
    deliveryMode,
    probeResult,
    containerExtension,
    availabilityId: selectedId,
    startPositionSeconds,
    alternatives,
  }
}
