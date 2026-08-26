import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { selectPreferredSources } from '../channels/source-selector.js'
import { createSession, patchSession } from './playback-session-store.js'
import { createHlsSession, waitForPlaylist } from './hls-session-store.js'
import { isFfmpegAvailable } from './ffmpeg-availability.js'
import { classifyDelivery } from './playback-compat.js'
import { probeMedia } from './media-prober.js'
import { MEDIA_RELAY_SECRET } from '../config/env.js'
import { buildMediaRelayPlayUrl } from './media-relay-ticket.js'
import { getMediaRelayBaseUrl, isMediaRelayEnabled } from './media-relay-runtime.js'
import type { ChannelPlaybackResponse } from '@iptvflix/api-contracts'
import type { DeliveryMode } from './playback-compat.js'

function inferContainerFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const match = pathname.match(/\.([a-z0-9]+)$/)
    if (match) {
      const ext = match[1]!
      if (['ts', 'm3u8', 'm3u', 'mkv', 'mp4', 'm2ts'].includes(ext)) return ext
    }
  } catch {
    // ignore invalid URLs
  }
  return 'ts'
}

function extensionFallbackMode(ext: string): DeliveryMode {
  const e = ext.toLowerCase().replace(/^\./, '')
  if (e === 'm3u8' || e === 'm3u') return 'DIRECT'
  if (e === 'ts' || e === 'mkv' || e === 'avi' || e === 'flv') return 'HLS_REMUX'
  return 'HLS_TRANSCODE_FULL'
}

function needsRelayRemux(ext: string): boolean {
  const e = (ext || '').toLowerCase().replace(/^\./, '')
  return e === 'mkv' || e === 'ts' || e === 'm2ts' || e === 'avi' || e === ''
}

export async function resolveChannelPlayback(
  profileId: string,
  channelId: string,
  correlationId = randomUUID(),
): Promise<ChannelPlaybackResponse> {
  const rows = await db
    .select({
      id: channelSources.id,
      channelId: channelSources.channelId,
      sourceId: channelSources.sourceId,
      streamUrl: channelSources.streamUrl,
      priority: channelSources.priority,
      status: channelSources.status,
      lastSeenAt: channelSources.lastSeenAt,
    })
    .from(channelSources)
    .where(eq(channelSources.channelId, channelId))

  const ordered = selectPreferredSources(
    rows.map((r) => ({
      ...r,
      status: r.status as 'AVAILABLE' | 'UNAVAILABLE',
    })),
  )

  const primary = ordered.find((s) => s.status === 'AVAILABLE')
  if (!primary) {
    throw new Error('Channel stream unavailable')
  }

  const providerStreamUrl = primary.streamUrl
  const containerExtension = inferContainerFromUrl(providerStreamUrl)

  let deliveryMode: DeliveryMode = extensionFallbackMode(containerExtension)

  try {
    const probe = await probeMedia(providerStreamUrl)
    deliveryMode = classifyDelivery(probe)
  } catch {
    deliveryMode = extensionFallbackMode(containerExtension)
  }

  if (deliveryMode !== 'DIRECT' && !(await isFfmpegAvailable())) {
    deliveryMode = 'DIRECT'
  }

  const mediaRelayEnabled = isMediaRelayEnabled()
  if (mediaRelayEnabled && deliveryMode !== 'DIRECT') {
    deliveryMode = 'DIRECT'
  }

  const sessionId = createSession({
    profileId,
    mediaType: 'channel',
    mediaId: channelId,
    availabilityId: primary.id,
    sourceId: primary.sourceId,
    providerStreamUrl,
    containerExtension,
    deliveryMode,
    correlationId,
  })

  if (deliveryMode !== 'DIRECT') {
    try {
      await createHlsSession(sessionId, providerStreamUrl, deliveryMode, 0)
      const ready = await waitForPlaylist(sessionId, 15_000)
      if (ready) {
        return {
          gatewayUrl: `/playback/session/${sessionId}/master.m3u8`,
          deliveryMode,
          containerExtension,
          correlationId,
        }
      }
      patchSession(sessionId, { deliveryMode: 'DIRECT' })
      deliveryMode = 'DIRECT'
    } catch {
      patchSession(sessionId, { deliveryMode: 'DIRECT' })
      deliveryMode = 'DIRECT'
    }
  }

  const relayBase = getMediaRelayBaseUrl()
  const relaySecret = MEDIA_RELAY_SECRET
  const useMediaRelay = mediaRelayEnabled && Boolean(relayBase && relaySecret)

  const gatewayUrl = useMediaRelay
    ? buildMediaRelayPlayUrl({
        relayBaseUrl: relayBase!,
        secret: relaySecret!,
        providerStreamUrl,
        containerExtension,
        startPositionSeconds: 0,
      })
    : `/playback/stream/${sessionId}`

  const clientDeliveryMode: DeliveryMode =
    useMediaRelay && needsRelayRemux(containerExtension) ? 'HLS_REMUX' : deliveryMode

  return {
    gatewayUrl,
    deliveryMode: clientDeliveryMode,
    containerExtension,
    correlationId,
  }
}
