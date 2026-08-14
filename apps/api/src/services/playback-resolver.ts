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
import type { PlaybackSessionResponse, AvailabilityVariantResponse } from '@iptvflix/api-contracts'

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

  const sessionId = createSession({
    profileId,
    mediaType,
    mediaId,
    availabilityId: selectedId,
    sourceId: selected.providerId,
    providerStreamUrl,
    containerExtension,
  })

  console.info('playback-resolver: session created', {
    sessionId,
    mediaType,
    mediaId,
    availabilityId: selectedId,
    sourceId: selected.providerId,
    containerExtension,
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

  return { gatewayUrl: `/api/playback/stream/${sessionId}`, containerExtension, availabilityId: selectedId, startPositionSeconds, alternatives }
}
