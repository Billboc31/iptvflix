import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { channelSources } from '../db/schema/channel-sources.js'
import { sources } from '../db/schema/sources.js'
import { selectPreferredSources } from '../channels/source-selector.js'
import {
  mapChannelSourceToVariant,
  type ChannelSourceVariantInput,
} from '../channels/channel-source-variant.js'
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

type LoadedChannelSource = ChannelSourceVariantInput & {
  channelId: string
  priority: number
  lastSeenAt: Date
}

async function loadChannelSources(channelId: string): Promise<LoadedChannelSource[]> {
  const rows = await db
    .select({
      id: channelSources.id,
      channelId: channelSources.channelId,
      sourceId: channelSources.sourceId,
      streamUrl: channelSources.streamUrl,
      priority: channelSources.priority,
      status: channelSources.status,
      lastSeenAt: channelSources.lastSeenAt,
      providerName: channelSources.providerName,
      groupTitle: channelSources.groupTitle,
      sourceDisplayName: sources.name,
    })
    .from(channelSources)
    .innerJoin(sources, eq(channelSources.sourceId, sources.id))
    .where(eq(channelSources.channelId, channelId))

  return rows.map((r) => ({
    id: r.id,
    channelId: r.channelId,
    sourceId: r.sourceId,
    streamUrl: r.streamUrl,
    priority: r.priority,
    status: r.status as 'AVAILABLE' | 'UNAVAILABLE',
    lastSeenAt: r.lastSeenAt,
    providerName: r.providerName,
    groupTitle: r.groupTitle,
    sourceDisplayName: r.sourceDisplayName,
  }))
}

function pickPrimarySource(
  ordered: LoadedChannelSource[],
  channelSourceId?: string,
): LoadedChannelSource | undefined {
  if (channelSourceId) {
    const explicit = ordered.find((s) => s.id === channelSourceId && s.status === 'AVAILABLE')
    if (explicit) return explicit
  }
  return ordered.find((s) => s.status === 'AVAILABLE')
}

async function buildGatewayForSource(
  profileId: string,
  channelId: string,
  primary: LoadedChannelSource,
  correlationId: string,
  nativeClient: boolean,
): Promise<Omit<ChannelPlaybackResponse, 'availabilityId' | 'alternatives'>> {
  const providerStreamUrl = primary.streamUrl
  const containerExtension = inferContainerFromUrl(providerStreamUrl)

  let deliveryMode: DeliveryMode = extensionFallbackMode(containerExtension)

  if (!nativeClient) {
    try {
      const probe = await probeMedia(providerStreamUrl)
      deliveryMode = classifyDelivery(probe)
    } catch {
      deliveryMode = extensionFallbackMode(containerExtension)
    }
  } else {
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
  const useMediaRelay =
    !nativeClient &&
    mediaRelayEnabled &&
    Boolean(relayBase && relaySecret)

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

export async function resolveChannelPlayback(
  profileId: string,
  channelId: string,
  correlationId = randomUUID(),
  opts?: { clientType?: 'web' | 'android-tv'; channelSourceId?: string },
): Promise<ChannelPlaybackResponse> {
  const nativeClient = opts?.clientType === 'android-tv'
  const loaded = await loadChannelSources(channelId)
  const ordered = selectPreferredSources(
    loaded.map((r) => ({
      id: r.id,
      channelId: r.channelId,
      sourceId: r.sourceId,
      streamUrl: r.streamUrl,
      priority: r.priority,
      status: r.status,
      lastSeenAt: r.lastSeenAt,
    })),
  )

  const byId = new Map(loaded.map((r) => [r.id, r]))
  const orderedLoaded = ordered
    .map((r) => byId.get(r.id))
    .filter((r): r is LoadedChannelSource => r != null)

  const primary = pickPrimarySource(orderedLoaded, opts?.channelSourceId)
  if (!primary) {
    throw new Error('Channel stream unavailable')
  }

  const alternatives = orderedLoaded
    .filter((s) => s.status === 'AVAILABLE')
    .map((s) => mapChannelSourceToVariant(s))

  const session = await buildGatewayForSource(
    profileId,
    channelId,
    primary,
    correlationId,
    nativeClient,
  )

  return {
    ...session,
    availabilityId: primary.id,
    alternatives,
  }
}
