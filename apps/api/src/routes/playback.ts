import { createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import type { PlaybackResolveRequest } from '@iptvflix/api-contracts'
import { resolvePlayback } from '../services/playback-resolver.js'
import { getSession } from '../services/playback-session-store.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js'
import { getPlaylist, getSegment, SEGMENT_RE } from '../services/hls-session-store.js'
import { XTREAM_STREAM_HEADERS, fetchXtreamStream } from '../providers/xtream/playback.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const UPSTREAM_TIMEOUT_MS = 30_000

// Rewrites provider HLS manifest segment URIs to proxy through IPTVFlix,
// keeping provider credentials server-side.
function rewriteHlsManifest(manifest: string, sessionId: string, manifestUrl: string): string {
  function toAbsolute(uri: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
    try {
      const base = new URL(manifestUrl)
      return new URL(uri, base).toString()
    } catch {
      return uri
    }
  }

  function proxyUri(uri: string): string {
    const abs = toAbsolute(uri)
    const encoded = Buffer.from(abs).toString('base64url')
    return `/playback/stream/${sessionId}/segment?uri=${encoded}`
  }

  return manifest
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${proxyUri(uri)}"`)
      }
      return proxyUri(trimmed)
    })
    .join('\n')
}

export async function playbackRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Params: { mediaType: string; mediaId: string }
    Body: PlaybackResolveRequest
  }>(
    '/playback/resolve/:mediaType/:mediaId',
    async (request, reply) => {
      const { mediaType, mediaId } = request.params

      if (mediaType !== 'movie' && mediaType !== 'episode') {
        return reply.status(400).send({ error: 'mediaType must be movie or episode' })
      }
      if (!UUID_RE.test(mediaId)) {
        return reply.status(400).send({ error: 'Invalid mediaId' })
      }

      const { availabilityId } = request.body ?? {}

      try {
        const session = await resolvePlayback(
          DEFAULT_PROFILE_ID,
          mediaType,
          mediaId,
          availabilityId,
        )
        return reply.status(200).send(session)
      } catch (err) {
        if (err instanceof NotFoundError) {
          return reply.status(404).send({ error: 'Variant not available' })
        }
        if (err instanceof ValidationError) {
          return reply.status(400).send({ error: 'Variant not available' })
        }
        if (err instanceof ForbiddenError) {
          return reply.status(403).send({ error: 'Variant not available' })
        }
        throw err
      }
    },
  )

  // DIRECT delivery: proxy MP4 (with Range support) or provider-native HLS (with segment rewriting).
  // HLS_* sessions are served at /playback/session/:id/master.m3u8 — return 409 here.
  app.get<{
    Params: { sessionId: string }
  }>(
    '/playback/stream/:sessionId',
    async (request, reply) => {
      const { sessionId } = request.params

      const session = getSession(sessionId)
      if (!session) {
        return reply.status(404).send({ error: 'Playback session not found or expired' })
      }

      if (session.profileId !== DEFAULT_PROFILE_ID) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      if (session.deliveryMode !== 'DIRECT') {
        return reply.status(409).send({ error: 'Stream is served via HLS — use the playlist URL' })
      }

      const { providerStreamUrl, containerExtension, mediaId, availabilityId, sourceId } = session
      const logCtx = { sessionId, mediaId, availabilityId, sourceId, containerExtension, deliveryMode: 'DIRECT' }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
      request.raw.on('close', () => controller.abort())

      let upstreamRes: Response
      try {
        const upstreamHeaders: Record<string, string> = {}
        const rangeHeader = request.headers['range']
        if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

        upstreamRes = await fetchXtreamStream(
          providerStreamUrl,
          upstreamHeaders,
          controller.signal,
        )
        clearTimeout(timeoutId)
      } catch (err) {
        clearTimeout(timeoutId)
        const isAbort = err instanceof Error && err.name === 'AbortError'
        if (isAbort) {
          app.log.warn({ ...logCtx, err: 'upstream timeout or client disconnect' }, 'playback-gateway: upstream aborted')
          return reply.status(504).send({ error: 'Fournisseur ne répond pas' })
        }
        app.log.error({ ...logCtx, err }, 'playback-gateway: upstream fetch failed')
        return reply.status(502).send({ error: 'Erreur fournisseur' })
      }

      if (upstreamRes.status === 401 || upstreamRes.status === 403) {
        app.log.warn({ ...logCtx, upstreamStatus: upstreamRes.status }, 'playback-gateway: upstream auth error')
        return reply.status(upstreamRes.status).send({ error: 'Source expirée — contactez l\'administrateur' })
      }

      if (upstreamRes.status === 404) {
        app.log.warn({ ...logCtx }, 'playback-gateway: upstream 404')
        return reply.status(404).send({ error: 'Média introuvable chez le fournisseur' })
      }

      if (!upstreamRes.ok) {
        app.log.warn({ ...logCtx, upstreamStatus: upstreamRes.status }, 'playback-gateway: upstream error')
        return reply.status(502).send({
          error: 'Erreur fournisseur',
          upstreamStatus: upstreamRes.status,
        })
      }

      const upstreamContentType = upstreamRes.headers.get('Content-Type') ?? 'unknown'
      app.log.info({
        ...logCtx,
        upstreamStatus: upstreamRes.status,
        upstreamContentType,
      }, 'playback-gateway: upstream response')

      const ext = (containerExtension ?? 'ts').toLowerCase()
      const streamBody = upstreamRes.body

      // Provider-native HLS: rewrite segment URIs to keep credentials server-side
      if (ext === 'm3u8' || ext === 'm3u') {
        reply.header('Content-Type', 'application/vnd.apple.mpegurl')
        const body = streamBody ? await new Response(streamBody).text() : await upstreamRes.text()
        const rewritten = rewriteHlsManifest(body, sessionId, providerStreamUrl)
        app.log.info({ ...logCtx, responseMode: 'direct-hls' }, 'playback-gateway: serving provider HLS')
        return reply.status(upstreamRes.status).send(rewritten)
      }

      // Direct pass-through with Range header support (mp4, mpeg-ts, …)
      const fallbackType = ext === 'ts' || ext === 'm2ts' || ext === 'mts'
        ? 'video/mp2t'
        : 'video/mp4'
      const respContentType = upstreamRes.headers.get('Content-Type') ?? fallbackType
      const respContentLength = upstreamRes.headers.get('Content-Length')
      const respContentRange = upstreamRes.headers.get('Content-Range')
      reply.header('Content-Type', respContentType)
      if (respContentLength) reply.header('Content-Length', respContentLength)
      if (respContentRange) reply.header('Content-Range', respContentRange)
      reply.header('Accept-Ranges', 'bytes')
      reply.status(upstreamRes.status)
      app.log.info({ ...logCtx, responseMode: 'direct-stream' }, 'playback-gateway: serving DIRECT stream')

      if (!streamBody) return reply.send('')
      try {
        return reply.send(Readable.fromWeb(streamBody as import('stream/web').ReadableStream))
      } catch (err) {
        app.log.error({ ...logCtx, err }, 'playback-gateway: failed to pipe upstream body')
        return reply.status(502).send({ error: 'Erreur fournisseur' })
      }
    },
  )

  // HLS segment proxy for provider-native HLS streams (DIRECT mode with HLS manifest).
  // Fetches an individual provider segment server-side, keeping credentials out of the browser.
  app.get<{ Params: { sessionId: string }; Querystring: { uri?: string } }>(
    '/playback/stream/:sessionId/segment',
    async (request, reply) => {
      const { sessionId } = request.params
      const { uri } = request.query

      if (!uri) {
        return reply.status(400).send({ error: 'Missing uri parameter' })
      }

      const session = getSession(sessionId)
      if (!session) {
        return reply.status(404).send({ error: 'Playback session not found or expired' })
      }

      let segmentUrl: string
      try {
        segmentUrl = Buffer.from(uri, 'base64url').toString('utf8')
      } catch {
        return reply.status(400).send({ error: 'Invalid uri encoding' })
      }

      if (!segmentUrl.startsWith('http://') && !segmentUrl.startsWith('https://')) {
        return reply.status(400).send({ error: 'Invalid segment URL' })
      }

      const logCtx = { sessionId, mediaId: session.mediaId, segmentUrl: segmentUrl.slice(0, 80) }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
      request.raw.on('close', () => controller.abort())

      let upstreamRes: Response
      try {
        upstreamRes = await fetch(segmentUrl, {
          signal: controller.signal,
          headers: XTREAM_STREAM_HEADERS,
        })
        clearTimeout(timeoutId)
      } catch (err) {
        clearTimeout(timeoutId)
        const isAbort = err instanceof Error && err.name === 'AbortError'
        app.log.warn({ ...logCtx }, `playback-gateway: segment ${isAbort ? 'timeout' : 'fetch error'}`)
        return reply.status(504).send({ error: 'Fournisseur ne répond pas' })
      }

      if (!upstreamRes.ok) {
        app.log.warn({ ...logCtx, upstreamStatus: upstreamRes.status }, 'playback-gateway: segment upstream error')
        return reply.status(upstreamRes.status).send({ error: 'Segment unavailable' })
      }

      reply.header('Content-Type', upstreamRes.headers.get('Content-Type') ?? 'video/MP2T')
      const contentLength = upstreamRes.headers.get('Content-Length')
      if (contentLength) reply.header('Content-Length', contentLength)

      if (!upstreamRes.body) return reply.send('')
      return reply.send(Readable.fromWeb(upstreamRes.body as import('stream/web').ReadableStream))
    },
  )

  // HLS master playlist for backend-generated HLS sessions (HLS_REMUX / HLS_TRANSCODE_*).
  app.get<{ Params: { sessionId: string } }>(
    '/playback/session/:sessionId/master.m3u8',
    async (request, reply) => {
      const { sessionId } = request.params

      const session = getSession(sessionId)
      if (!session) {
        return reply.status(404).send({ error: 'Playback session not found or expired' })
      }

      if (session.profileId !== DEFAULT_PROFILE_ID) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const logCtx = { sessionId, mediaId: session.mediaId, deliveryMode: session.deliveryMode }

      const result = await getPlaylist(sessionId)

      if (result.status === 'gone') {
        app.log.warn({ ...logCtx }, 'playback-gateway: HLS session gone or failed')
        return reply.status(410).send({ error: 'Playback session expired or failed' })
      }

      if (result.status === 'not_ready') {
        app.log.info({ ...logCtx }, 'playback-gateway: HLS playlist not yet ready')
        return reply.status(404).send({ error: 'Playlist not yet available' })
      }

      const playlistBytes = Buffer.byteLength(result.content, 'utf8')
      const segmentCount = result.content.split('\n').filter((l) => l.includes('/segments/')).length
      app.log.info({ ...logCtx, playlistSizeBytes: playlistBytes, segmentCount }, 'playback-gateway: serving HLS playlist')

      reply.header('Content-Type', 'application/vnd.apple.mpegurl')
      reply.header('Cache-Control', 'no-cache')
      return reply.status(200).send(result.content)
    },
  )

  // HLS segment file for backend-generated HLS sessions.
  app.get<{ Params: { sessionId: string; filename: string } }>(
    '/playback/session/:sessionId/segments/:filename',
    async (request, reply) => {
      const { sessionId, filename } = request.params

      if (!SEGMENT_RE.test(filename)) {
        return reply.status(400).send({ error: 'Invalid segment filename' })
      }

      const session = getSession(sessionId)
      if (!session) {
        return reply.status(404).send({ error: 'Playback session not found or expired' })
      }

      if (session.profileId !== DEFAULT_PROFILE_ID) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const logCtx = { sessionId, mediaId: session.mediaId, filename }

      const result = await getSegment(sessionId, filename)

      if (result.status === 'invalid') {
        return reply.status(400).send({ error: 'Invalid segment filename' })
      }

      if (result.status === 'gone') {
        app.log.warn({ ...logCtx }, 'playback-gateway: HLS segment session gone or failed')
        return reply.status(410).send({ error: 'Playback session expired or failed' })
      }

      if (result.status === 'not_ready') {
        return reply.status(404).send({ error: 'Segment not yet available' })
      }

      const filePath = result.filePath
      let fileSize: number | undefined
      try {
        const { stat } = await import('node:fs/promises')
        const info = await stat(filePath)
        fileSize = info.size
      } catch {
        return reply.status(404).send({ error: 'Segment not yet available' })
      }

      app.log.info({ ...logCtx, sizeBytes: fileSize }, 'playback-gateway: serving HLS segment')

      reply.header('Content-Type', 'video/MP2T')
      reply.header('Content-Length', String(fileSize))
      return reply.send(createReadStream(filePath))
    },
  )
}
