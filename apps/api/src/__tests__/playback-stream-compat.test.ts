import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PassThrough } from 'node:stream'
import Fastify from 'fastify'
import { createSession } from '../services/playback-session-store.js'

// These mocks are hoisted by Vitest above the static imports below.
// Mocking playback-resolver and profile-service prevents loading db/client
// (which requires DATABASE_URL) since these tests are pure unit tests.
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}))

vi.mock('../services/media-prober.js', () => ({
  probeMedia: vi.fn(),
}))

vi.mock('../services/probe-cache.js', () => ({
  getProbe: vi.fn(() => null),
  setProbe: vi.fn(),
}))

vi.mock('../services/playback-resolver.js', () => ({
  resolvePlayback: vi.fn(),
}))

vi.mock('../services/profile-service.js', () => ({
  DEFAULT_PROFILE_ID: '00000000-0000-0000-0000-000000000001',
  getDefaultProfilePreferences: vi.fn(),
}))


import { spawn } from 'node:child_process'
import { probeMedia } from '../services/media-prober.js'
import { getProbe } from '../services/probe-cache.js'
import { playbackRoutes } from '../routes/playback.js'
import type { MediaInfo } from '../services/media-prober.js'

const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
const SAFARI_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

// Builds a fake ffmpeg ChildProcess-like object whose stdout emits one chunk then ends.
// Captures whether kill() was called.
function createFakeFfmpeg(opts: { willFail?: boolean } = {}) {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  const stdin = new PassThrough()
  const proc: {
    stdin: PassThrough
    stdout: PassThrough
    stderr: PassThrough
    killed: boolean
    kill: ReturnType<typeof vi.fn>
    on: ReturnType<typeof vi.fn>
    once: ReturnType<typeof vi.fn>
  } = {
    stdin,
    stdout,
    stderr,
    killed: false,
    kill: vi.fn(() => { proc.killed = true }),
    on: vi.fn(),
    once: vi.fn((event: string, cb: (code?: number) => void) => {
      if (event === 'error' || event === 'close') {
        // Do not resolve these unless willFail
        if (opts.willFail && event === 'close') {
          setTimeout(() => cb(1), 5)
        }
      }
    }),
  }

  if (!opts.willFail) {
    // Emit first chunk so the route can proceed
    setTimeout(() => {
      stdout.write(Buffer.from('fmp4data'))
      stdout.end()
    }, 5)
  }

  return proc
}

// Creates a minimal Web ReadableStream from a Buffer for use as a Response body
function makeWebStream(data: Buffer): ReadableStream {
  return new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(new Uint8Array(data))
      ctrl.close()
    },
  })
}

describe('playback stream handler — compat path', () => {
  let app: ReturnType<typeof Fastify>
  const PROVIDER_URL = 'http://provider.internal/movie/42/stream.mkv'

  beforeEach(async () => {
    vi.clearAllMocks()

    app = Fastify({ logger: false })
    await app.register(playbackRoutes)
    await app.ready()

    // Default: probeMedia returns MKV/H264/AAC → REMUX
    vi.mocked(probeMedia).mockResolvedValue({
      videoCodec: 'h264',
      audioCodec: 'aac',
      containerFormat: 'matroska,webm',
    } satisfies MediaInfo)

    vi.mocked(getProbe).mockReturnValue(null)

    // Default fake ffmpeg process
    vi.mocked(spawn).mockReturnValue(createFakeFfmpeg() as any)

    // Mock global fetch to return a fake upstream video stream
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(makeWebStream(Buffer.from('videobytes')), {
        status: 200,
        headers: { 'Content-Type': 'video/mp4' },
      }),
    ))
  })

  it('REMUX: Safari UA triggers compat path with stream-copy ffmpeg args', async () => {
    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000010',
      availabilityId: 'avail-remux',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toMatch(/video\/mp4/)
    expect(vi.mocked(probeMedia)).toHaveBeenCalledOnce()
    expect(vi.mocked(spawn)).toHaveBeenCalledOnce()

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    // REMUX: stream copy
    expect(spawnArgs).toContain('-c')
    expect(spawnArgs).toContain('copy')
    expect(spawnArgs).not.toContain('libx264')
  })

  it('compat=1 query param forces compat path even without Safari UA', async () => {
    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000011',
      availabilityId: 'avail-query-compat',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}?compat=1`,
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0' },
    })

    expect(res.statusCode).toBe(200)
    expect(vi.mocked(probeMedia)).toHaveBeenCalledOnce()
    expect(vi.mocked(spawn)).toHaveBeenCalledOnce()
  })

  it('TRANSCODE_AUDIO: H264 + AC3 triggers audio-only transcode', async () => {
    vi.mocked(probeMedia).mockResolvedValue({
      videoCodec: 'h264',
      audioCodec: 'ac3',
      containerFormat: 'mpegts',
    })

    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000012',
      availabilityId: 'avail-transcode-audio',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'ts',
    })

    await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('-c:v')
    expect(spawnArgs).toContain('copy')
    expect(spawnArgs).toContain('-c:a')
    expect(spawnArgs).toContain('aac')
    expect(spawnArgs).not.toContain('libx264')
  })

  it('TRANSCODE_VIDEO: VP9 + AAC triggers video transcode', async () => {
    vi.mocked(probeMedia).mockResolvedValue({
      videoCodec: 'vp9',
      audioCodec: 'aac',
      containerFormat: 'matroska,webm',
    })

    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000013',
      availabilityId: 'avail-transcode-video',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('libx264')
    expect(spawnArgs).toContain('-c:a')
    expect(spawnArgs).toContain('copy')
  })

  it('TRANSCODE_FULL: VP9 + Vorbis triggers full transcode', async () => {
    vi.mocked(probeMedia).mockResolvedValue({
      videoCodec: 'vp9',
      audioCodec: 'vorbis',
      containerFormat: 'matroska,webm',
    })

    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000014',
      availabilityId: 'avail-transcode-full',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    const spawnArgs = vi.mocked(spawn).mock.calls[0][1] as string[]
    expect(spawnArgs).toContain('libx264')
    expect(spawnArgs).toContain('aac')
  })

  it('probe cache hit: probeMedia is not called again for same availabilityId', async () => {
    const cachedInfo: MediaInfo = { videoCodec: 'h264', audioCodec: 'aac', containerFormat: 'matroska,webm' }
    vi.mocked(getProbe).mockReturnValue(cachedInfo)

    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000015',
      availabilityId: 'avail-cache-hit',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    expect(vi.mocked(probeMedia)).not.toHaveBeenCalled()
    expect(vi.mocked(spawn)).toHaveBeenCalledOnce()
  })

  it('provider URL does not appear in any log call', async () => {
    // Use a logger that captures output
    const logMessages: string[] = []
    const loggingApp = Fastify({
      logger: {
        level: 'debug',
        stream: {
          write(msg: string) {
            logMessages.push(msg)
          },
        },
      },
    })
    await loggingApp.register(playbackRoutes)
    await loggingApp.ready()

    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000016',
      availabilityId: 'avail-no-url-log',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    await loggingApp.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    await loggingApp.close()

    const allLogs = logMessages.join('\n')
    // Provider URL must not appear in any log line
    expect(allLogs).not.toContain(PROVIDER_URL)
  })

  it('non-Safari, non-compat Chrome request does not probe or trigger compat path', async () => {
    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000017',
      availabilityId: 'avail-non-safari',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    await app.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0' },
    })

    expect(vi.mocked(probeMedia)).not.toHaveBeenCalled()
  })

  it('client disconnect kills ffmpeg process', async () => {
    // Hooks must be registered before app.ready(), so this test uses its own Fastify instance.
    const disconnectApp = Fastify({ logger: false })
    let capturedRaw: import('http').IncomingMessage | null = null
    disconnectApp.addHook('preHandler', async (req) => { capturedRaw = req.raw })
    await disconnectApp.register(playbackRoutes)
    await disconnectApp.ready()

    const mockFfmpegInstance = createFakeFfmpeg()
    vi.mocked(spawn).mockReturnValue(mockFfmpegInstance as any)

    const sessionId = createSession({
      profileId: DEFAULT_PROFILE_ID,
      mediaType: 'movie',
      mediaId: '00000000-0000-0000-0000-000000000018',
      availabilityId: 'avail-disconnect',
      sourceId: 'source-1',
      providerStreamUrl: PROVIDER_URL,
      containerExtension: 'mkv',
    })

    const res = await disconnectApp.inject({
      method: 'GET',
      url: `/playback/stream/${sessionId}`,
      headers: { 'user-agent': SAFARI_IOS_UA },
    })

    expect(res.statusCode).toBe(200)
    expect(capturedRaw).not.toBeNull()

    // Simulate client disconnect: the route registered request.raw.on('close', killFfmpeg).
    // Emitting 'close' exercises that handler. Since ffmpeg.killed is still false
    // (process ended normally via stdout.end(), kill was never called), kill() fires now.
    capturedRaw!.emit('close')

    expect(mockFfmpegInstance.kill).toHaveBeenCalled()
    await disconnectApp.close()
  })
})
