#!/usr/bin/env node
/**
 * T080 diagnostic script — verify Railway deployment prerequisites for ffmpeg/ffprobe.
 * Run: node apps/api/scripts/check-env.mjs
 * Output is JSON, suitable for /api/diagnostics/env or manual inspection.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const exec = promisify(execFile)

async function run(cmd, args) {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 10_000 })
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (err) {
    return {
      ok: false,
      code: err.code,
      signal: err.signal,
      stdout: (err.stdout ?? '').trim(),
      stderr: (err.stderr ?? '').trim(),
      message: err.message,
    }
  }
}

async function checkTmpDir() {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'iptvflix-diag-'))
    rmSync(dir, { recursive: true })
    return { ok: true, tmpdir: tmpdir() }
  } catch (err) {
    return { ok: false, error: err.message, tmpdir: tmpdir() }
  }
}

async function main() {
  const result = {
    timestamp: new Date().toISOString(),
    platform: process.platform,
    nodeVersion: process.version,
    resolvedPath: process.env.PATH ?? null,
    railwayEnvironment: process.env.RAILWAY_ENVIRONMENT ?? null,
    ffmpegWhich: await run('which', ['ffmpeg']),
    ffmpegVersion: await run('ffmpeg', ['-version']),
    ffprobeWhich: await run('which', ['ffprobe']),
    ffprobeVersion: await run('ffprobe', ['-version']),
    tmpDirWritable: await checkTmpDir(),
    memoryUsage: process.memoryUsage(),
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error('check-env failed:', err)
  process.exit(1)
})
