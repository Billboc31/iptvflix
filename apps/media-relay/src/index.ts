import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream, existsSync, mkdirSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import Fastify from 'fastify'
import { verifyRelayTicket } from './ticket.js'

const PORT = Number(process.env.PORT ?? 8080)
const SECRET = process.env.MEDIA_RELAY_SECRET
if (!SECRET) {
  console.error('MEDIA_RELAY_SECRET is required')
  process.exit(1)
}

const UA =
  process.env.MEDIA_RELAY_UA ??
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const SESSION_TTL_MS = 45 * 60 * 1000
const ROOT = join(tmpdir(), 'iptvflix-media-relay')
mkdirSync(ROOT, { recursive: true })

type RemuxSession = {
  id: string
  dir: string
  child: ChildProcess
  createdAt: number
}

const remuxSessions = new Map<string, RemuxSession>()

function cleanupSessions() {
  const now = Date.now()
  for (const [id, s] of remuxSessions) {
    if (now - s.createdAt > SESSION_TTL_MS) {
      try {
        s.child.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      try {
        rmSync(s.dir, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
      remuxSessions.delete(id)
    }
  }
}
setInterval(cleanupSessions, 60_000).unref()

function isBrowserNativeMp4(ext: string): boolean {
  const e = ext.toLowerCase().replace(/^\./, '')
  return e === 'mp4' || e === 'm4v' || e === 'mov'
}

function needsRemux(ext: string): boolean {
  const e = ext.toLowerCase().replace(/^\./, '')
  return e === 'mkv' || e === 'ts' || e === 'm2ts' || e === 'avi' || e === 'hevc' || e === ''
}

async function fetchUpstream(url: string, range?: string): Promise<Response> {
  const headers: Record<string, string> = {
    'User-Agent': UA,
    Accept: '*/*',
  }
  if (range) headers.Range = range
  return fetch(url, { headers, redirect: 'follow' })
}

/** Swap movie/series file extension: …/123.ts → …/123.mkv */
function withExtension(url: string, ext: string): string {
  try {
    const u = new URL(url)
    u.pathname = u.pathname.replace(/\.[a-z0-9]+$/i, `.${ext}`)
    return u.toString()
  } catch {
    return url.replace(/\.[a-z0-9]+$/i, `.${ext}`)
  }
}

async function resolveWorkingUpstream(url: string, hintedExt: string): Promise<{ url: string; ext: string }> {
  const preferred = ['mkv', 'mp4', 'm4v', hintedExt, 'ts'].filter(Boolean)
  const seen = new Set<string>()
  const candidates: Array<{ url: string; ext: string }> = []
  for (const ext of preferred) {
    const e = ext.toLowerCase().replace(/^\./, '')
    const candidate = withExtension(url, e)
    if (seen.has(candidate)) continue
    seen.add(candidate)
    candidates.push({ url: candidate, ext: e })
  }
  // Always try original URL last if not already listed
  if (!seen.has(url)) candidates.push({ url, ext: hintedExt })

  for (const c of candidates) {
    try {
      const res = await fetchUpstream(c.url, 'bytes=0-1')
      if (res.status === 200 || res.status === 206) {
        // Drain tiny body so the socket can close cleanly
        await res.arrayBuffer().catch(() => undefined)
        return c
      }
      await res.arrayBuffer().catch(() => undefined)
    } catch {
      /* try next */
    }
  }
  return { url, ext: hintedExt }
}

function startRemux(sessionId: string, upstreamUrl: string, startPositionSeconds = 0): RemuxSession {
  const dir = join(ROOT, sessionId)
  mkdirSync(dir, { recursive: true })
  const playlist = join(dir, 'index.m3u8')
  const segmentPattern = join(dir, 'seg_%03d.m4s')

  const seekArgs: string[] = startPositionSeconds > 30 ? ['-ss', String(Math.floor(startPositionSeconds))] : []

  // Phone browsers (Chrome Android, Safari) cannot play HEVC-in-MPEG-TS.
  // Transcode to H.264 + AAC fMP4 HLS so iOS/Android can play natively / via hls.js.
  const child = spawn(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-user_agent',
      UA,
      '-hwaccel',
      'videotoolbox',
      ...seekArgs,
      '-i',
      upstreamUrl,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-sn',
      '-dn',
      '-vf',
      'scale=-2:1080',
      '-c:v',
      'h264_videotoolbox',
      '-b:v',
      '5M',
      '-maxrate',
      '6M',
      '-bufsize',
      '10M',
      '-profile:v',
      'main',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-ac',
      '2',
      '-b:a',
      '128k',
      '-f',
      'hls',
      '-hls_time',
      '4',
      '-hls_list_size',
      '0',
      '-hls_segment_type',
      'fmp4',
      '-hls_fmp4_init_filename',
      'init.mp4',
      '-hls_flags',
      'independent_segments',
      '-hls_segment_filename',
      segmentPattern,
      playlist,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  child.stderr.on('data', (chunk: Buffer) => {
    const line = chunk.toString('utf8').trim()
    if (line) console.warn({ sessionId, ffmpeg: line.slice(0, 300) })
  })

  const session: RemuxSession = { id: sessionId, dir, child, createdAt: Date.now() }
  remuxSessions.set(sessionId, session)
  return session
}

async function waitForFile(path: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(path) && statSync(path).size > 0) return true
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

function createId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

const app = Fastify({ logger: true })

app.addHook('onRequest', async (request, reply) => {
  reply.header('Access-Control-Allow-Origin', '*')
  reply.header('Access-Control-Allow-Headers', 'Range, Content-Type')
  reply.header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  reply.header('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges')
  if (request.method === 'OPTIONS') {
    return reply.status(204).send()
  }
})

app.get('/health', async () => ({ ok: true, service: 'media-relay' }))

app.get<{ Querystring: { ticket?: string } }>('/v1/play', async (request, reply) => {
  const ticket = request.query.ticket
  if (!ticket) return reply.status(400).send({ error: 'missing_ticket' })

  let payload
  try {
    payload = verifyRelayTicket(ticket, SECRET)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'invalid_ticket'
    return reply.status(401).send({ error: msg })
  }

  const hintedExt = (payload.e || 'mp4').toLowerCase().replace(/^\./, '')
  const resolved = await resolveWorkingUpstream(payload.u, hintedExt)
  const ext = resolved.ext
  const upstreamUrl = resolved.url
  request.log.info({ hintedExt, resolvedExt: ext }, 'upstream extension resolved')

  // Native MP4: proxy bytes (Range) over HTTPS — no credentials in browser.
  if (isBrowserNativeMp4(ext) || !needsRemux(ext)) {
    const range = typeof request.headers.range === 'string' ? request.headers.range : undefined
    let upstream: Response
    try {
      upstream = await fetchUpstream(upstreamUrl, range)
    } catch (err) {
      request.log.error({ err }, 'upstream fetch failed')
      return reply.status(502).send({ error: 'upstream_unreachable' })
    }

    if (upstream.status === 401 || upstream.status === 403) {
      return reply.status(502).send({ error: 'upstream_forbidden', status: upstream.status })
    }
    if (!upstream.ok && upstream.status !== 206) {
      return reply.status(502).send({ error: 'upstream_error', status: upstream.status })
    }

    const ct = upstream.headers.get('content-type') ?? 'video/mp4'
    reply.header('Content-Type', ct)
    const cl = upstream.headers.get('content-length')
    const cr = upstream.headers.get('content-range')
    if (cl) reply.header('Content-Length', cl)
    if (cr) reply.header('Content-Range', cr)
    reply.header('Accept-Ranges', 'bytes')
    reply.header('Access-Control-Allow-Origin', '*')
    reply.header('Cache-Control', 'no-store')
    reply.status(upstream.status)

    if (!upstream.body) return reply.send('')
    return reply.send(Readable.fromWeb(upstream.body as import('stream/web').ReadableStream))
  }

  // MKV / TS / etc.: remux to HLS on this host (IP not blocked by Cloudflare).
  const sessionId = `r_${createId()}`
  const startPositionSeconds = typeof payload.s === 'number' && Number.isFinite(payload.s) ? payload.s : 0
  const session = startRemux(sessionId, upstreamUrl, startPositionSeconds)
  const playlistPath = join(session.dir, 'index.m3u8')
  const ready = await waitForFile(playlistPath, 90_000)
  if (!ready) {
    try {
      session.child.kill('SIGKILL')
    } catch {
      /* ignore */
    }
    remuxSessions.delete(sessionId)
    return reply.status(504).send({ error: 'remux_timeout' })
  }

  reply.header('Cache-Control', 'no-store')
  const forwardedHost = request.headers['x-forwarded-host']
  const host = String(forwardedHost ?? request.headers.host ?? '').split(',')[0]!.trim()
  const isLocal = !host || host.startsWith('127.') || host.startsWith('localhost') || host.startsWith('[::1]')
  const proto = isLocal ? 'http' : 'https'
  const location = host ? `${proto}://${host}/v1/hls/${sessionId}/index.m3u8` : `/v1/hls/${sessionId}/index.m3u8`
  return reply.redirect(location)
})

app.get<{ Params: { sessionId: string; file: string } }>(
  '/v1/hls/:sessionId/:file',
  async (request, reply) => {
    const { sessionId, file } = request.params
    if (!/^[a-zA-Z0-9._-]+$/.test(file) || file.includes('..')) {
      return reply.status(400).send({ error: 'bad_file' })
    }
    const session = remuxSessions.get(sessionId)
    if (!session) return reply.status(404).send({ error: 'session_gone' })

    const path = join(session.dir, file)
    if (!existsSync(path)) {
      const ok = await waitForFile(path, 8_000)
      if (!ok) return reply.status(404).send({ error: 'segment_missing' })
    }

    reply.header('Cache-Control', 'no-store')
    if (file.endsWith('.m3u8')) {
      reply.header('Content-Type', 'application/vnd.apple.mpegurl')
    } else if (file.endsWith('.m4s') || file.endsWith('.mp4')) {
      reply.header('Content-Type', 'video/mp4')
    } else {
      reply.header('Content-Type', 'video/mp2t')
    }
    return reply.send(createReadStream(path))
  },
)

await app.listen({ port: PORT, host: '0.0.0.0' })
console.info({ port: PORT }, 'media-relay listening')
