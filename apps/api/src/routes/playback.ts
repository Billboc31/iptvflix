import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import type { FastifyInstance } from 'fastify'
import type { PlaybackResolveRequest } from '@iptvflix/api-contracts'
import { resolvePlayback } from '../services/playback-resolver.js'
import { getSession } from '../services/playback-session-store.js'
import { DEFAULT_PROFILE_ID } from '../services/profile-service.js'
import { ValidationError, ForbiddenError, NotFoundError } from '../errors.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const UPSTREAM_TIMEOUT_MS = 30_000

// Container extensions that require remuxing to fmp4 via ffmpeg
const REMUX_EXTENSIONS = new Set(['ts', 'mkv', 'avi', 'flv', 'wmv'])

// Container extensions that are passed through directly to the browser
const PASSTHROUGH_EXTENSIONS = new Set(['mp4', 'm3u8', 'm3u'])


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

  app.get<{ Params: { sessionId: string } }>(
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

      const ext = containerExtension.toLowerCase()

      // HLS manifest pass-through
      if (ext === 'm3u8' || ext === 'm3u') {
        app.log.info({ ...logCtx }, 'playback-gateway: hls pass-through')
        reply.header('Content-Type', 'application/vnd.apple.mpegurl')
        const body = await upstreamRes.text()
        return reply.status(upstreamRes.status).send(body)
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

        if (!upstreamRes.body) {
          return reply.send('')
        }

        const nodeReadable = Readable.fromWeb(upstreamRes.body as import('stream/web').ReadableStream)
        return reply.send(nodeReadable)
      }

      // REMUX: ts/mkv/avi → fragmented MP4 via ffmpeg
      if (REMUX_EXTENSIONS.has(ext)) {
        app.log.info({ ...logCtx }, 'playback-gateway: remuxing to fmp4')

        if (!upstreamRes.body) {
          return reply.status(415).send({ error: 'Format non supporté par votre navigateur' })
        }

        const ffmpeg = spawn('ffmpeg', [
          '-i', 'pipe:0',
          '-c', 'copy',
          '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
          '-f', 'mp4',
          'pipe:1',
        ], { stdio: ['pipe', 'pipe', 'pipe'] })

        ffmpeg.stderr.on('data', () => {
          // discard ffmpeg stderr to avoid log noise
        })

        // Pipe upstream → ffmpeg stdin
        const inputStream = Readable.fromWeb(upstreamRes.body as import('stream/web').ReadableStream)
        inputStream.pipe(ffmpeg.stdin)
        inputStream.on('error', () => {
          if (!ffmpeg.killed) ffmpeg.kill('SIGKILL')
        })

        // Abort ffmpeg on client disconnect
        request.raw.on('close', () => {
          if (!ffmpeg.killed) ffmpeg.kill('SIGKILL')
        })

        // Wait for the first output chunk or an error before committing to a response.
        // This ensures we can return 415 cleanly if ffmpeg is missing or fails immediately.
        const firstChunk = await Promise.race<Buffer | null>([
          new Promise<Buffer>((resolve) => ffmpeg.stdout.once('data', (chunk: Buffer) => resolve(chunk))),
          new Promise<null>((resolve) => ffmpeg.once('error', () => resolve(null))),
          new Promise<null>((resolve) => ffmpeg.once('close', (code) => { if (code !== 0) resolve(null) })),
        ])

        if (firstChunk === null) {
          if (!ffmpeg.killed) ffmpeg.kill('SIGKILL')
          app.log.warn({ ...logCtx }, 'playback-gateway: ffmpeg unavailable or failed to start')
          return reply.status(415).send({ error: 'Format non supporté par votre navigateur' })
        }

        // ffmpeg started producing output — write the first chunk back and stream the rest
        const { PassThrough } = await import('node:stream')
        const outputStream = new PassThrough()
        outputStream.write(firstChunk)
        ffmpeg.stdout.pipe(outputStream)

        reply.header('Content-Type', 'video/mp4')
        reply.header('Transfer-Encoding', 'chunked')
        reply.status(200)
        return reply.send(outputStream)
      }

      // Unknown extension — attempt mp4 pass-through as fallback
      app.log.info({ ...logCtx }, 'playback-gateway: unknown extension, attempting mp4 pass-through')
      reply.header('Content-Type', 'video/mp4')
      reply.header('Accept-Ranges', 'bytes')
      const contentLength = upstreamRes.headers.get('Content-Length')
      if (contentLength) reply.header('Content-Length', contentLength)

      if (!upstreamRes.body) return reply.send('')
      const nodeReadable = Readable.fromWeb(upstreamRes.body as import('stream/web').ReadableStream)
      return reply.send(nodeReadable)
    },
  )
}
