import { describe, it, expect, vi, beforeEach } from 'vitest'
import { join } from 'node:path'

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const mockSpawn = vi.hoisted(() => vi.fn())
const mockMkdtemp = vi.hoisted(() => vi.fn())
const mockReadFile = vi.hoisted(() => vi.fn())
const mockReaddir = vi.hoisted(() => vi.fn())
const mockRm = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({ spawn: mockSpawn }))
vi.mock('node:fs/promises', () => ({
  mkdtemp: mockMkdtemp,
  readFile: mockReadFile,
  readdir: mockReaddir,
  rm: mockRm,
}))

// buildFfmpegArgs is pure — use real implementation
vi.mock('../playback-compat.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../playback-compat.js')>()
  return actual
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

import { EventEmitter } from 'node:events'

function makeFakeProcess(overrides: {
  pid?: number
  killed?: boolean
  stderr?: EventEmitter
} = {}) {
  const proc = new EventEmitter() as ReturnType<typeof mockSpawn>
  proc.pid = overrides.pid ?? 1234
  proc.killed = overrides.killed ?? false
  proc.kill = vi.fn(() => { proc.killed = true })
  proc.stdin = null
  proc.stdout = null
  proc.stderr = overrides.stderr ?? new EventEmitter()
  return proc
}

const TEMP_DIR = '/tmp/iptvflix-hls-test-session'
const SESSION_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const PROVIDER_URL = 'http://provider.example.com/user/pass/video.ts'

// ---------------------------------------------------------------------------
// Tests — after each test we re-import to get a fresh module state
// (Vitest reuses module cache; use dynamic imports with cache-busting)
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  mockMkdtemp.mockResolvedValue(TEMP_DIR)
  mockRm.mockResolvedValue(undefined)
  mockReaddir.mockResolvedValue([])
})

describe('SEGMENT_RE', () => {
  it('matches valid segment filenames', async () => {
    const { SEGMENT_RE } = await import('../hls-session-store.js')
    expect(SEGMENT_RE.test('seg00001.ts')).toBe(true)
    expect(SEGMENT_RE.test('seg99999.ts')).toBe(true)
    expect(SEGMENT_RE.test('seg00000.ts')).toBe(true)
  })

  it('rejects filenames with path traversal', async () => {
    const { SEGMENT_RE } = await import('../hls-session-store.js')
    expect(SEGMENT_RE.test('../../../etc/passwd')).toBe(false)
    expect(SEGMENT_RE.test('seg00001.ts..')).toBe(false)
    expect(SEGMENT_RE.test('/tmp/seg00001.ts')).toBe(false)
    expect(SEGMENT_RE.test('arbitrary.ts')).toBe(false)
    expect(SEGMENT_RE.test('seg0001.ts')).toBe(false)  // only 5 digits
  })
})

describe('createHlsSession', () => {
  it('creates a temp dir and spawns ffmpeg', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)

    const { createHlsSession } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    expect(mockMkdtemp).toHaveBeenCalledOnce()
    expect(mockSpawn).toHaveBeenCalledOnce()

    const [binary, args] = mockSpawn.mock.calls[0]!
    expect(binary).toBe('ffmpeg')
    expect(args).toContain(PROVIDER_URL)
    expect(args).toContain('-c')
    expect(args).toContain('copy')
    expect(args).toContain('hls')
  })

  it('includes the temp dir in ffmpeg segment and playlist paths', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)

    const { createHlsSession } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    const [, args] = mockSpawn.mock.calls[0]!
    const hasSegPath = (args as string[]).some((a) => a.includes(TEMP_DIR) && a.includes('seg'))
    const hasPlaylistPath = (args as string[]).some((a) => a === `${TEMP_DIR}/master.m3u8`)
    expect(hasSegPath).toBe(true)
    expect(hasPlaylistPath).toBe(true)
  })
})

describe('getPlaylist', () => {
  it('returns not_ready when playlist file does not yet exist', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)
    mockReadFile.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))

    const { createHlsSession, getPlaylist } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    const result = await getPlaylist(SESSION_ID)
    expect(result.status).toBe('not_ready')
  })

  it('returns ok with rewritten segment URLs', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)

    const rawPlaylist = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-TARGETDURATION:6',
      `#EXTINF:6.000,`,
      `${TEMP_DIR}/seg00001.ts`,
      '#EXT-X-ENDLIST',
    ].join('\n')
    mockReadFile.mockResolvedValue(rawPlaylist)

    const { createHlsSession, getPlaylist } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    const result = await getPlaylist(SESSION_ID)
    expect(result.status).toBe('ok')

    if (result.status !== 'ok') return
    // Segment URL must be rewritten to IPTVFlix proxy path
    expect(result.content).toContain(`/api/playback/session/${SESSION_ID}/segments/seg00001.ts`)
    // Original temp path must NOT appear in the rewritten output
    expect(result.content).not.toContain(TEMP_DIR)
  })

  it('preserves HLS comment lines unchanged', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)

    const rawPlaylist = '#EXTM3U\n#EXT-X-VERSION:3\n'
    mockReadFile.mockResolvedValue(rawPlaylist)

    const { createHlsSession, getPlaylist } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    const result = await getPlaylist(SESSION_ID)
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.content).toContain('#EXTM3U')
      expect(result.content).toContain('#EXT-X-VERSION:3')
    }
  })
})

describe('getSegment', () => {
  it('returns invalid for non-matching filename', async () => {
    const { getSegment } = await import('../hls-session-store.js')
    const result = await getSegment(SESSION_ID, '../../../etc/passwd')
    expect(result.status).toBe('invalid')
  })

  it('returns invalid for filename without 5-digit pattern', async () => {
    const { getSegment } = await import('../hls-session-store.js')
    const result = await getSegment(SESSION_ID, 'arbitrary.ts')
    expect(result.status).toBe('invalid')
  })

  it('returns gone for unknown session', async () => {
    const { getSegment } = await import('../hls-session-store.js')
    const result = await getSegment('nonexistent-session', 'seg00001.ts')
    expect(result.status).toBe('gone')
  })

  it('returns ok with correct filePath for valid segment', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)
    mockReaddir.mockResolvedValue(['seg00001.ts'])

    const { createHlsSession, getSegment } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    const result = await getSegment(SESSION_ID, 'seg00001.ts')
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.filePath).toBe(join(TEMP_DIR, 'seg00001.ts'))
    }
  })

  it('marks session failed and returns gone when segment count exceeds limit', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)

    // Generate 501 segment filenames
    const manySegments = Array.from({ length: 501 }, (_, i) => `seg${String(i).padStart(5, '0')}.ts`)
    mockReaddir.mockResolvedValue(manySegments)

    const { createHlsSession, getSegment } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    const result = await getSegment(SESSION_ID, 'seg00001.ts')
    expect(result.status).toBe('gone')
  })
})

describe('getHlsSession marks failed on non-zero ffmpeg exit', () => {
  it('marks session as failed when ffmpeg exits with non-zero code', async () => {
    const proc = makeFakeProcess()
    mockSpawn.mockReturnValue(proc)
    mockReadFile.mockRejectedValue(new Error('ENOENT'))

    const { createHlsSession, getPlaylist } = await import('../hls-session-store.js')
    await createHlsSession(SESSION_ID, PROVIDER_URL, 'HLS_REMUX')

    // Simulate ffmpeg exiting with error
    proc.emit('close', 1, null)

    const result = await getPlaylist(SESSION_ID)
    // After ffmpeg failure, session should be marked failed → gone
    expect(result.status).toBe('gone')
  })
})
