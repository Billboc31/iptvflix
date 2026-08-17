import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildFfmpegArgs } from './playback-compat.js'
import type { DeliveryMode } from './playback-compat.js'
import { ffmpegInputArgs } from '../providers/xtream/playback.js'

const TTL_MS = 3 * 60 * 60 * 1000
const MAX_SEGMENTS = 1500

// Only seg00001.ts style filenames are valid — prevents path traversal
export const SEGMENT_RE = /^seg\d{5}\.ts$/

type HlsSessionEntry = {
  sessionId: string
  tempDir: string
  process: ChildProcess
  createdAt: number
  expiresAt: number
  failed: boolean
  failedReason?: string
}

const sessions = new Map<string, HlsSessionEntry>()

const cleanupTimer = setInterval(() => {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (session.expiresAt <= now) {
      void expireSession(id, session)
    }
  }
}, 5 * 60 * 1000)
cleanupTimer.unref()

async function expireSession(id: string, session: HlsSessionEntry): Promise<void> {
  sessions.delete(id)
  if (!session.process.killed) session.process.kill('SIGKILL')
  try {
    await rm(session.tempDir, { recursive: true, force: true })
  } catch {
    // best-effort: temp dir will be cleaned by OS eventually
  }
}

/**
 * Spawns an ffmpeg HLS session for a given playback session ID.
 * The same ID is used in both the playback session store and this store.
 */
export async function createHlsSession(
  sessionId: string,
  providerUrl: string,
  mode: DeliveryMode,
): Promise<void> {
  const tempDir = await mkdtemp(join(tmpdir(), 'iptvflix-hls-'))

  const codecArgs = buildFfmpegArgs(mode, tempDir)
  const inputArgs = await ffmpegInputArgs(providerUrl)
  const fullArgs = [
    ...inputArgs,
    ...codecArgs,
  ]

  const proc = spawn('ffmpeg', fullArgs, { stdio: ['ignore', 'ignore', 'pipe'] })

  const stderrLines: string[] = []
  proc.stderr?.on('data', (chunk: Buffer) => {
    const lines = chunk.toString().split('\n').filter(Boolean)
    stderrLines.push(...lines)
    if (stderrLines.length > 50) stderrLines.splice(0, stderrLines.length - 50)
  })

  const entry: HlsSessionEntry = {
    sessionId,
    tempDir,
    process: proc,
    createdAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
    failed: false,
  }

  proc.on('close', (code, signal) => {
    const s = sessions.get(sessionId)
    if (s && !s.failed && code !== 0) {
      const stderrTail = stderrLines.slice(-5).join(' | ')
      s.failed = true
      s.failedReason = `ffmpeg exited code=${code} signal=${signal}: ${stderrTail}`
      console.error('hls-session-store: ffmpeg exited with error', {
        sessionId,
        exitCode: code,
        signal,
        stderrTail,
      })
    }
  })

  proc.on('error', (err) => {
    const s = sessions.get(sessionId)
    if (s && !s.failed) {
      s.failed = true
      s.failedReason = err.message
    }
  })

  sessions.set(sessionId, entry)
}

export function getHlsSession(sessionId: string): HlsSessionEntry | null {
  const entry = sessions.get(sessionId)
  if (!entry) return null
  if (entry.expiresAt <= Date.now()) {
    void expireSession(sessionId, entry)
    return null
  }
  return entry
}

export type PlaylistResult =
  | { status: 'ok'; content: string }
  | { status: 'not_ready' }
  | { status: 'gone' }

export async function getPlaylist(sessionId: string): Promise<PlaylistResult> {
  const entry = getHlsSession(sessionId)
  if (!entry) return { status: 'gone' }
  if (entry.failed) return { status: 'gone' }

  const playlistPath = join(entry.tempDir, 'master.m3u8')

  let raw: string
  try {
    raw = await readFile(playlistPath, 'utf8')
  } catch {
    return { status: 'not_ready' }
  }

  // Rewrite ffmpeg-generated segment paths to IPTVFlix authenticated proxy URLs
  const content = raw
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return line
      const filename = trimmed.split('/').pop() ?? trimmed
      if (SEGMENT_RE.test(filename)) {
        return `/playback/session/${sessionId}/segments/${filename}`
      }
      return line
    })
    .join('\n')

  return { status: 'ok', content }
}

export async function waitForPlaylist(sessionId: string, timeoutMs = 15_000): Promise<boolean> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const result = await getPlaylist(sessionId)
    if (result.status === 'ok') return true
    if (result.status === 'gone') return false
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return false
}

export type SegmentResult =
  | { status: 'ok'; filePath: string }
  | { status: 'not_ready' }
  | { status: 'gone' }
  | { status: 'invalid' }

export async function getSegment(sessionId: string, filename: string): Promise<SegmentResult> {
  if (!SEGMENT_RE.test(filename)) return { status: 'invalid' }

  const entry = getHlsSession(sessionId)
  if (!entry) return { status: 'gone' }
  if (entry.failed) return { status: 'gone' }

  try {
    const files = await readdir(entry.tempDir)
    const count = files.filter((f) => SEGMENT_RE.test(f)).length
    if (count > MAX_SEGMENTS) {
      entry.failed = true
      entry.failedReason = `segment accumulation limit exceeded: ${count}`
      return { status: 'gone' }
    }
  } catch {
    return { status: 'gone' }
  }

  const segmentPath = join(entry.tempDir, filename)

  // Verify resolved path is inside the session temp dir (defense in depth)
  if (!segmentPath.startsWith(entry.tempDir + '/')) return { status: 'invalid' }

  return { status: 'ok', filePath: segmentPath }
}

export function getHlsSessionInfo(sessionId: string): { tempDir: string; createdAt: number } | null {
  const entry = getHlsSession(sessionId)
  if (!entry) return null
  return { tempDir: entry.tempDir, createdAt: entry.createdAt }
}
