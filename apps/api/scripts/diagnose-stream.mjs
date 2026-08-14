#!/usr/bin/env node
/**
 * T080 local stream diagnostic — exercises the exact compat pipeline locally.
 *
 * Covers without Railway deployment:
 *   Section 2 — upstream media metadata (ffprobe on URL, same as probeMedia())
 *   Section 3 — compatibility decision (inline classifyDelivery, isSafari=true)
 *   Section 4 — ffmpeg execution (fetch→pipe→ffmpeg stdin, same as runFfmpegStream())
 *   Section 6 — independent output validation (ffprobe on ffmpeg output file)
 *
 * Usage:
 *   node apps/api/scripts/diagnose-stream.mjs --url 'http://provider/stream' [--ext ts] [--duration 15]
 *
 * The URL is NEVER printed in any output line. The JSON report is safe to share.
 */

import { spawn, execFile } from 'node:child_process'
import { Readable } from 'node:stream'
import { createWriteStream, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// ---- Inline classifyDelivery — mirrors apps/api/src/services/playback-compat.ts ----

function classifyDelivery(mediaInfo, isSafari = true) {
  const video = mediaInfo.videoCodec.toLowerCase()
  const audio = mediaInfo.audioCodec.toLowerCase()
  const container = mediaInfo.containerFormat.toLowerCase()

  if (container.includes('hls') || container === 'm3u8' || container === 'm3u') return 'DIRECT'

  const isH264 = video === 'h264'
  const isHEVC = video === 'hevc' || video === 'h265'
  const isAAC = audio === 'aac'
  const isMp4Container = container.includes('mp4') || container.includes('mov') || container.includes('m4v')

  if (isH264) {
    if (isAAC && isMp4Container) return 'DIRECT'
    if (isAAC) return 'REMUX'
    return 'TRANSCODE_AUDIO'
  }

  if (isHEVC) {
    if (isSafari && isAAC && isMp4Container) return 'DIRECT'
    if (isSafari && isAAC) return 'REMUX'
    if (isSafari && !isAAC) return 'TRANSCODE_AUDIO'
    if (isAAC) return 'TRANSCODE_VIDEO'
    return 'TRANSCODE_FULL'
  }

  if (isAAC) return 'TRANSCODE_VIDEO'
  return 'TRANSCODE_FULL'
}

// ---- Inline buildFfmpegArgs — mirrors apps/api/src/services/playback-compat.ts ----

function buildFfmpegArgs(mode) {
  const OUTPUT_FLAGS = ['-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4']
  switch (mode) {
    case 'REMUX':            return ['-c', 'copy', ...OUTPUT_FLAGS]
    case 'TRANSCODE_AUDIO':  return ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', ...OUTPUT_FLAGS]
    case 'TRANSCODE_VIDEO':  return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', ...OUTPUT_FLAGS]
    case 'TRANSCODE_FULL':   return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', ...OUTPUT_FLAGS]
    default:                 return []
  }
}

// ---- Arg parsing ----

function parseArgs() {
  const argv = process.argv.slice(2)
  const result = { url: null, duration: 15, ext: 'ts' }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url')      result.url = argv[++i]
    else if (argv[i] === '--duration') result.duration = parseInt(argv[++i], 10)
    else if (argv[i] === '--ext') result.ext = argv[++i].replace(/^\./, '')
  }
  return result
}

// ---- Section 2: ffprobe upstream (same as probeMedia()) ----

async function probeUpstream(url) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      url,
    ], { timeout: 20_000 })
    const data = JSON.parse(stdout)
    const streams = data.streams ?? []
    const video = streams.find(s => s.codec_type === 'video') ?? {}
    const audio = streams.find(s => s.codec_type === 'audio') ?? {}
    return {
      ok: true,
      videoCodec: video.codec_name ?? 'unknown',
      videoProfile: video.profile ?? null,
      videoLevel: video.level ?? null,
      pixelFormat: video.pix_fmt ?? null,
      width: video.width ?? null,
      height: video.height ?? null,
      frameRate: video.r_frame_rate ?? null,
      audioCodec: audio.codec_name ?? 'unknown',
      audioChannels: audio.channels ?? null,
      sampleRate: audio.sample_rate ?? null,
      containerFormat: data.format?.format_name ?? 'unknown',
      duration: data.format?.duration ?? null,
    }
  } catch (err) {
    return { ok: false, error: err.message, stderr: err.stderr ?? null }
  }
}

// ---- Section 4: ffmpeg via fetch→pipe→stdin (same as runFfmpegStream()) ----

async function runFfmpegViaFetch(url, mode, durationSeconds, outputPath) {
  const ffmpegCodecArgs = buildFfmpegArgs(mode)
  // Mirror production: '-i pipe:0' for stdin, add '-t' to limit duration for local test
  const fullArgs = ['-i', 'pipe:0', ...ffmpegCodecArgs, '-t', String(durationSeconds), '-y', outputPath]
  const sanitizedArgs = ['-i', '<stdin>', ...ffmpegCodecArgs, '-t', String(durationSeconds), '-y', '<outputPath>']

  const result = {
    sanitizedArgs,
    mode,
    spawnedOk: false,
    pid: null,
    exitCode: null,
    exitSignal: null,
    stderrTail: [],
    msToFirstByte: null,
    firstOutputBytesHex: null,
    outputFileSizeBytes: null,
    spawnError: null,
    fetchError: null,
  }

  // Fetch upstream (mirrors production fetch() call)
  let fetchRes
  try {
    fetchRes = await fetch(url)
    if (!fetchRes.ok) {
      result.fetchError = `HTTP ${fetchRes.status} ${fetchRes.statusText}`
      return result
    }
  } catch (err) {
    result.fetchError = err.message
    return result
  }

  return new Promise((resolve) => {
    let proc
    try {
      proc = spawn('ffmpeg', fullArgs, { stdio: ['pipe', 'pipe', 'pipe'] })
    } catch (err) {
      result.spawnError = err.message
      resolve(result)
      return
    }

    result.pid = proc.pid
    result.spawnedOk = true

    const stderrLines = []
    proc.stderr.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean)
      stderrLines.push(...lines)
      if (stderrLines.length > 30) stderrLines.splice(0, stderrLines.length - 30)
    })

    const spawnStart = Date.now()
    let firstByteTime = null
    let firstBytes = null

    const outFile = createWriteStream(outputPath)
    proc.stdout.on('data', (chunk) => {
      if (firstByteTime === null) {
        firstByteTime = Date.now() - spawnStart
        firstBytes = Buffer.from(chunk.slice(0, 32)).toString('hex')
      }
    })
    proc.stdout.pipe(outFile)

    // Pipe fetch body → ffmpeg stdin (same as Readable.fromWeb + .pipe(ffmpeg.stdin))
    const inputStream = Readable.fromWeb(fetchRes.body)
    inputStream.pipe(proc.stdin)
    inputStream.on('error', () => {
      if (!proc.killed) proc.kill('SIGKILL')
    })

    proc.on('close', (code, signal) => {
      result.exitCode = code
      result.exitSignal = signal
      result.stderrTail = stderrLines.slice(-20)
      result.msToFirstByte = firstByteTime
      result.firstOutputBytesHex = firstBytes
      try {
        result.outputFileSizeBytes = statSync(outputPath).size
      } catch {}
      resolve(result)
    })

    proc.on('error', (err) => {
      result.spawnError = err.message
      result.spawnedOk = false
      resolve(result)
    })
  })
}

// ---- Section 6: ffprobe output file ----

async function probeOutputFile(path) {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      '-i', path,
    ], { timeout: 15_000 })
    const data = JSON.parse(stdout)
    const streams = data.streams ?? []
    const video = streams.find(s => s.codec_type === 'video') ?? {}
    const audio = streams.find(s => s.codec_type === 'audio') ?? {}
    return {
      ok: true,
      outputIsValidMedia: true,
      outputContainer: data.format?.format_name ?? null,
      outputVideoCodec: video.codec_name ?? null,
      outputAudioCodec: audio.codec_name ?? null,
      outputDuration: data.format?.duration ?? null,
      streams: streams.map(s => ({ type: s.codec_type, codec: s.codec_name })),
    }
  } catch (err) {
    return { ok: false, outputIsValidMedia: false, error: err.message }
  }
}

// ---- Main ----

async function main() {
  const args = parseArgs()
  if (!args.url) {
    console.error('Usage: node apps/api/scripts/diagnose-stream.mjs --url <XTREAM_URL> [--ext ts] [--duration 15]')
    console.error('  --url      Xtream stream URL (NEVER logged in output)')
    console.error('  --ext      Container extension hint (ts|mp4|mkv|avi, default: ts)')
    console.error('  --duration Seconds to capture via ffmpeg (default: 15)')
    process.exit(1)
  }

  const log = (msg) => process.stderr.write(`[diagnose-stream] ${msg}\n`)

  const REMUX_EXTENSIONS = new Set(['ts', 'mkv', 'avi', 'flv', 'webm'])
  const PASSTHROUGH_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'mp4v'])

  const report = {
    timestamp: new Date().toISOString(),
    extensionHint: args.ext,
    duration: args.duration,
    section2_upstreamProbe: null,
    section3_compatDecision: null,
    section4_ffmpegExecution: null,
    section6_outputValidation: null,
  }

  // Section 2
  log('Section 2: probing upstream with ffprobe...')
  const probe = await probeUpstream(args.url)
  report.section2_upstreamProbe = probe
  if (probe.ok) {
    log(`  videoCodec=${probe.videoCodec} audioCodec=${probe.audioCodec} container=${probe.containerFormat}`)
  } else {
    log(`  probe FAILED: ${probe.error}`)
  }

  // Section 3
  let mode = null
  if (probe.ok) {
    mode = classifyDelivery({ videoCodec: probe.videoCodec, audioCodec: probe.audioCodec, containerFormat: probe.containerFormat }, true)
    report.section3_compatDecision = {
      mode,
      inputs: { videoCodec: probe.videoCodec, audioCodec: probe.audioCodec, containerFormat: probe.containerFormat },
      isSafari: true,
    }
    log(`Section 3: classifyDelivery(isSafari=true) → ${mode}`)
  } else {
    const extLower = args.ext.toLowerCase()
    if (REMUX_EXTENSIONS.has(extLower)) mode = 'REMUX'
    else if (PASSTHROUGH_EXTENSIONS.has(extLower)) mode = 'DIRECT'
    report.section3_compatDecision = {
      mode,
      inputs: null,
      isSafari: true,
      note: `probe failed — extension fallback for .${args.ext}`,
    }
    log(`Section 3: probe failed, extension fallback → ${mode}`)
  }

  // Section 4
  if (mode && mode !== 'DIRECT') {
    const tmpDir = mkdtempSync(join(tmpdir(), 'iptvflix-diag-'))
    const outputPath = join(tmpDir, 'output.mp4')

    log(`Section 4: running ffmpeg (mode=${mode}, duration=${args.duration}s)...`)
    const ffmpegResult = await runFfmpegViaFetch(args.url, mode, args.duration, outputPath)
    report.section4_ffmpegExecution = ffmpegResult

    if (ffmpegResult.exitCode === 0) {
      log(`  ffmpeg OK — exitCode=0 msToFirstByte=${ffmpegResult.msToFirstByte} outputSize=${ffmpegResult.outputFileSizeBytes}B`)
    } else {
      log(`  ffmpeg FAILED — exitCode=${ffmpegResult.exitCode} signal=${ffmpegResult.exitSignal}`)
      log(`  stderr tail: ${ffmpegResult.stderrTail.slice(-3).join(' | ')}`)
    }

    // Section 6
    log('Section 6: probing ffmpeg output...')
    const outputProbe = await probeOutputFile(outputPath)
    report.section6_outputValidation = outputProbe
    if (outputProbe.ok) {
      log(`  output valid: container=${outputProbe.outputContainer} video=${outputProbe.outputVideoCodec} audio=${outputProbe.outputAudioCodec}`)
    } else {
      log(`  output INVALID: ${outputProbe.error}`)
    }

    try { rmSync(tmpDir, { recursive: true }) } catch {}
  } else if (mode === 'DIRECT') {
    report.section4_ffmpegExecution = { skipped: true, reason: 'DIRECT mode — no ffmpeg needed, upstream passes through' }
    report.section6_outputValidation = { skipped: true, reason: 'DIRECT mode — upstream is the output' }
    log('Section 4/6: skipped (DIRECT mode)')
  } else {
    report.section4_ffmpegExecution = { skipped: true, reason: 'delivery mode unknown' }
    report.section6_outputValidation = { skipped: true, reason: 'delivery mode unknown' }
    log('Section 4/6: skipped (mode unknown)')
  }

  // Output JSON report to stdout (URL never included)
  console.log(JSON.stringify(report, null, 2))
  log('Done. Copy the JSON above into runs/T080/diagnosis.md sections 2/3/4/6.')
}

main().catch((err) => {
  process.stderr.write(`diagnose-stream fatal: ${err.message}\n`)
  process.exit(1)
})
