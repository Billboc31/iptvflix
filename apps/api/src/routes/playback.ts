import { spawn } from 'node:child_process'
import { Readable, PassThrough } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import type { PlaybackResolveRequest } from '@iptvflix/api-contracts'
import { resolvePlayback } from '../services/playback-resolver.js'
import { getSession } from '../services/playback-session-store.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js'
import { probeMedia } from '../services/media-prober.js'
import { getProbe, setProbe } from '../services/probe-cache.js'
import { isSafariOrIOS, classifyDelivery, buildFfmpegArgs } from '../services/playback-compat.js'
import type { DeliveryMode } from '../services/playback-compat.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const UPSTREAM_TIMEOUT_MS = 30_000

// Container extensions that require remuxing to fmp4 via ffmpeg
const REMUX_EXTENSIONS = new Set(['ts', 'mkv', 'avi', 'flv', 'wmv'])

// Container extensions that are passed through directly to the browser
const PASSTHROUGH_EXTENSIONS = new Set(['mp4', 'm3u8', 'm3u'])


function rewriteHlsManifest(manifest: string, sessionId: string, manifestUrl: string): string {
  // Resolve a segment URI (relative or absolute) to an absolute URL
  function toAbsolute(uri: string): string {
    if (uri.startsWith('http://') || uri.startsWith('https://')) return uri
    try {
      const base = new URL(manifestUrl)
      // Resolve relative to the directory of the manifest URL
      return new URL(uri, base).toString()
    } catch {
      return uri
    }
  }

  function proxyUri(uri: string): string {
    const abs = toAbsolute(uri)
    const encoded = Buffer.from(abs).toString('base64url')
    return `/api/playback/stream/${sessionId}/segment?uri=${encoded}`
  }

  return manifest
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line

      // Lines starting with # may contain URI="..." attributes
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${proxyUri(uri)}"`)
      }

      // Plain segment URI line
      return proxyUri(trimmed)
    })
    .join('\n')
}

async function runFfmpegStream(
  upstreamBody: ReadableStream,
  mode: DeliveryMode,
  logCtx: Record<string, unknown>,
  app: FastifyInstance,
  onDisconnect: (cb: () => void) => void,
): Promise<PassThrough | null> {
  const ffmpegArgs = buildFfmpegArgs(mode)
  const fullArgs = ['-i', 'pipe:0', ...ffmpegArgs, 'pipe:1']
  const sanitizedArgs = ['-i', '<stdin>', ...ffmpegArgs, 'pipe:1']

  const spawnStart = Date.now()
  const ffmpeg = spawn('ffmpeg', fullArgs, { stdio: ['pipe', 'pipe', 'pipe'] })

  app.log.info({
    ...logCtx,
    ffmpegMode: mode,
    ffmpegPid: ffmpeg.pid,
    ffmpegArgs: sanitizedArgs,
  }, 'playback-gateway: ffmpeg spawn')

  const stderrLines: string[] = []
  ffmpeg.stderr.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean)
    stderrLines.push(...lines)
    if (stderrLines.length > 20) stderrLines.splice(0, stderrLines.length - 20)
  })

  ffmpeg.on('close', (code, signal) => {
    app.log.info({
      ...logCtx,
      ffmpegExitCode: code,
      ffmpegExitSignal: signal,
      ffmpegStderrTail: stderrLines.slice(-20).join('\n'),
    }, 'playback-gateway: ffmpeg closed')
  })

  const inputStream = Readable.fromWeb(upstreamBody as import('stream/web').ReadableStream)
  inputStream.pipe(ffmpeg.stdin)
  inputStream.on('error', () => {
    if (!ffmpeg.killed) ffmpeg.kill('SIGKILL')
  })

  let clientDisconnected = false
  onDisconnect(() => {
    clientDisconnected = true
    if (!ffmpeg.killed) ffmpeg.kill('SIGKILL')
    app.log.info({ ...logCtx, ffmpegAliveAtDisconnect: false }, 'playback-gateway: client disconnected, killed ffmpeg')
  })

  const firstChunk = await Promise.race<Buffer | null>([
    new Promise<Buffer>((resolve) => ffmpeg.stdout.once('data', (chunk: Buffer) => resolve(chunk))),
    new Promise<null>((resolve) => ffmpeg.once('error', () => resolve(null))),
    new Promise<null>((resolve) => ffmpeg.once('close', (code) => { if (code !== 0) resolve(null) })),
  ])

  if (firstChunk === null) {
    if (!ffmpeg.killed) ffmpeg.kill('SIGKILL')
    app.log.warn({
      ...logCtx,
      ffmpegStderrTail: stderrLines.slice(-20).join('\n'),
    }, 'playback-gateway: ffmpeg unavailable or failed to start')
    return null
  }

  const msToFirstByte = Date.now() - spawnStart
  app.log.info({ ...logCtx, msToFirstByte }, 'playback-gateway: ffmpeg first output byte')

  const outputStream = new PassThrough()
  outputStream.write(firstChunk)
  ffmpeg.stdout.pipe(outputStream)

  outputStream.on('finish', () => {
    if (!clientDisconnected) {
      app.log.info({ ...logCtx, ffmpegAliveAtFinish: !ffmpeg.killed }, 'playback-gateway: ffmpeg stream finished')
    }
  })

  return outputStream
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

  app.get<{
    Params: { sessionId: string }
    Querystring: { compat?: string }
  }>(
    '/playback/stream/:sessionId',
    async (request, reply) => {
      const { sessionId } = request.params

      const session = getSession(sessionId)
      if (!session) {
        return reply.status(404).send({ error: 'Playback session not found or expired' })
      }

      // Single-profile system: session is always for DEFAULT_PROFILE_ID
      if (session.profileId !== DEFAULT_PROFILE_ID) {
        return reply.status(403).send({ error: 'Forbidden' })
      }

      const { providerStreamUrl, containerExtension, mediaId, availabilityId, sourceId } = session

      const logCtx = { sessionId, mediaId, availabilityId, sourceId, containerExtension }

      // Determine whether to use the compat path
      const userAgent = request.headers['user-agent'] ?? ''
      const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)

      let deliveryMode: DeliveryMode | null = null

      if (useCompat) {
        let mediaInfo = getProbe(availabilityId)
        if (!mediaInfo) {
          app.log.info({ ...logCtx }, 'playback-gateway: probing media for compat')
          try {
            mediaInfo = await probeMedia(providerStreamUrl)
            setProbe(availabilityId, mediaInfo)
            app.log.info({
              ...logCtx,
              probeVideoCodec: mediaInfo.videoCodec,
              probeAudioCodec: mediaInfo.audioCodec,
              probeContainerFormat: mediaInfo.containerFormat,
            }, 'playback-gateway: probe complete')
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err)
            // Determine extension-based fallback assumptions for diagnostic visibility
            const ext = containerExtension.toLowerCase()
            const fallbackRoute = REMUX_EXTENSIONS.has(ext)
              ? `remux-via-ffmpeg (ext=${ext})`
              : PASSTHROUGH_EXTENSIONS.has(ext)
                ? `direct-passthrough (ext=${ext})`
                : `unknown-ext-fallback (ext=${ext})`
            app.log.warn({
              ...logCtx,
              probeError: errMsg,
              extensionFallbackRoute: fallbackRoute,
            }, 'playback-gateway: probe failed, using extension-based routing')
          }
        }
        if (mediaInfo) {
          deliveryMode = classifyDelivery(mediaInfo, true)
          app.log.info({
            ...logCtx,
            deliveryMode,
            classifyInputVideoCodec: mediaInfo.videoCodec,
            classifyInputAudioCodec: mediaInfo.audioCodec,
            classifyInputContainer: mediaInfo.containerFormat,
            classifyInputExtension: containerExtension,
          }, 'playback-gateway: compat delivery mode selected')
        }
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

      // Abort upstream fetch on client disconnect
      request.raw.on('close', () => controller.abort())

      let upstreamRes: Response
      try {
        const upstreamHeaders: Record<string, string> = {}
        const rangeHeader = request.headers['range']
        if (rangeHeader) upstreamHeaders['Range'] = rangeHeader

        upstreamRes = await fetch(providerStreamUrl, {
          signal: controller.signal,
          headers: upstreamHeaders,
        })
        clearTimeout(timeoutId)
      } catch (err) {
        clearTimeout(timeoutId)
        const isAbort = err instanceof Error && err.name === 'AbortError'
        if (isAbort) {
          app.log.warn({ ...logCtx, err: 'upstream timeout or client disconnect' }, 'playback-gateway: upstream aborted')
          return reply.status(504).send({ error: 'Fournisseur ne répond pas' })
        }
        throw err
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
        return reply.status(502).send({ error: 'Erreur fournisseur' })
      }

      // Log upstream response headers for diagnostic correlation
      const upstreamContentType = upstreamRes.headers.get('Content-Type') ?? 'unknown'
      const upstreamContentLength = upstreamRes.headers.get('Content-Length')
      const upstreamTransferEncoding = upstreamRes.headers.get('Transfer-Encoding')
      app.log.info({
        ...logCtx,
        upstreamStatus: upstreamRes.status,
        upstreamContentType,
        upstreamContentLength: upstreamContentLength ?? null,
        upstreamIsChunked: !upstreamContentLength || upstreamTransferEncoding === 'chunked',
        upstreamTransferEncoding: upstreamTransferEncoding ?? null,
      }, 'playback-gateway: upstream response headers')

      // Peek first 16 bytes of upstream body for content signature (detect HTML error pages)
      let streamBody = upstreamRes.body
      let upstreamFirstBytesHex = 'n/a'
      if (streamBody) {
        try {
          const [peekStream, mainStream] = streamBody.tee()
          const reader = peekStream.getReader()
          const { value: peekChunk } = await reader.read()
          await reader.cancel()
          if (peekChunk) {
            upstreamFirstBytesHex = Buffer.from(peekChunk.slice(0, 16)).toString('hex')
          }
          streamBody = mainStream
        } catch {
          // tee unavailable in this runtime, skip peek
        }
      }
      app.log.info({ ...logCtx, upstreamFirstBytesHex }, 'playback-gateway: upstream body signature')

      // Compat path: probe-classified delivery
      if (deliveryMode !== null) {
        if (deliveryMode === 'DIRECT') {
          const ext = containerExtension.toLowerCase()
          if (ext === 'm3u8' || ext === 'm3u') {
            app.log.info({ ...logCtx }, 'playback-gateway: compat DIRECT — hls pass-through')
            reply.header('Content-Type', 'application/vnd.apple.mpegurl')
            const body = streamBody ? await new Response(streamBody).text() : await upstreamRes.text()
            const rewritten = rewriteHlsManifest(body, sessionId, providerStreamUrl)
            app.log.info({
              ...logCtx,
              responseContentType: 'application/vnd.apple.mpegurl',
              responseMode: 'compat-direct-hls',
            }, 'playback-gateway: response headers to browser')
            return reply.status(upstreamRes.status).send(rewritten)
          }
          app.log.info({ ...logCtx }, 'playback-gateway: compat DIRECT — mp4 pass-through')
          const respContentType = upstreamRes.headers.get('Content-Type') ?? 'video/mp4'
          const respContentLength = upstreamRes.headers.get('Content-Length')
          const respContentRange = upstreamRes.headers.get('Content-Range')
          reply.header('Content-Type', respContentType)
          if (respContentLength) reply.header('Content-Length', respContentLength)
          if (respContentRange) reply.header('Content-Range', respContentRange)
          reply.header('Accept-Ranges', 'bytes')
          reply.status(upstreamRes.status)
          app.log.info({
            ...logCtx,
            responseContentType: respContentType,
            responseContentLength: respContentLength ?? null,
            responseContentRange: respContentRange ?? null,
            responseAcceptRanges: 'bytes',
            responseMode: 'compat-direct-mp4',
          }, 'playback-gateway: response headers to browser')
          if (!streamBody) return reply.send('')
          return reply.send(Readable.fromWeb(streamBody as import('stream/web').ReadableStream))
        }

        // REMUX / TRANSCODE_* — run ffmpeg with the classified args
        if (!streamBody) {
          return reply.status(415).send({ error: 'Format non supporté par votre navigateur' })
        }

        const outputStream = await runFfmpegStream(
          streamBody,
          deliveryMode,
          logCtx,
          app,
          (cb) => request.raw.on('close', cb),
        )

        if (outputStream === null) {
          return reply.status(415).send({ error: 'Format non supporté par votre navigateur' })
        }

        reply.header('Content-Type', 'video/mp4')
        reply.status(200)
        app.log.info({
          ...logCtx,
          responseContentType: 'video/mp4',
          responseTransferEncoding: 'chunked',
          responseMode: `compat-${deliveryMode.toLowerCase()}`,
        }, 'playback-gateway: response headers to browser')
        return reply.send(outputStream)
      }

      // Non-compat path: existing extension-based routing (unchanged)
      const ext = containerExtension.toLowerCase()

      // HLS manifest pass-through with segment URL rewriting
      if (ext === 'm3u8' || ext === 'm3u') {
        app.log.info({ ...logCtx }, 'playback-gateway: hls pass-through with segment rewrite')
        reply.header('Content-Type', 'application/vnd.apple.mpegurl')
        const body = streamBody ? await new Response(streamBody).text() : await upstreamRes.text()
        const rewritten = rewriteHlsManifest(body, sessionId, providerStreamUrl)
        return reply.status(upstreamRes.status).send(rewritten)
      }

      // MP4 pass-through with Range support
      if (ext === 'mp4' || PASSTHROUGH_EXTENSIONS.has(ext)) {
        app.log.info({ ...logCtx }, 'playback-gateway: mp4 pass-through')
        reply.header('Content-Type', upstreamRes.headers.get('Content-Type') ?? 'video/mp4')
        const contentLength = upstreamRes.headers.get('Content-Length')
        if (contentLength) reply.header('Content-Length', contentLength)
        const contentRange = upstreamRes.headers.get('Content-Range')
        if (contentRange) reply.header('Content-Range', contentRange)
        reply.header('Accept-Ranges', 'bytes')
        reply.status(upstreamRes.status)

        if (!streamBody) {
          return reply.send('')
        }

        const nodeReadable = Readable.fromWeb(streamBody as import('stream/web').ReadableStream)
        return reply.send(nodeReadable)
      }

      // REMUX: ts/mkv/avi → fragmented MP4 via ffmpeg
      if (REMUX_EXTENSIONS.has(ext)) {
        app.log.info({ ...logCtx, legacyExtPath: true }, 'playback-gateway: legacy ext-path remuxing to fmp4')

        if (!streamBody) {
          return reply.status(415).send({ error: 'Format non supporté par votre navigateur' })
        }

        const outputStream = await runFfmpegStream(
          streamBody,
          'REMUX',
          { ...logCtx, legacyExtPath: true },
          app,
          (cb) => request.raw.on('close', cb),
        )

        if (outputStream === null) {
          return reply.status(415).send({ error: 'Format non supporté par votre navigateur' })
        }

        reply.header('Content-Type', 'video/mp4')
        reply.status(200)
        app.log.info({
          ...logCtx,
          legacyExtPath: true,
          responseContentType: 'video/mp4',
          responseTransferEncoding: 'chunked',
          responseMode: 'legacy-ext-remux',
        }, 'playback-gateway: response headers to browser')
        return reply.send(outputStream)
      }

      // Unknown extension — attempt mp4 pass-through as fallback
      app.log.info({ ...logCtx }, 'playback-gateway: unknown extension, attempting mp4 pass-through')
      reply.header('Content-Type', 'video/mp4')
      reply.header('Accept-Ranges', 'bytes')
      const contentLength = upstreamRes.headers.get('Content-Length')
      if (contentLength) reply.header('Content-Length', contentLength)

      if (!streamBody) return reply.send('')
      const nodeReadable = Readable.fromWeb(streamBody as import('stream/web').ReadableStream)
      return reply.send(nodeReadable)
    },
  )

  // HLS segment proxy — fetches an individual segment on behalf of the client,
  // keeping provider credentials server-side and avoiding CORS/mixed-content issues.
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
        upstreamRes = await fetch(segmentUrl, { signal: controller.signal })
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
}
