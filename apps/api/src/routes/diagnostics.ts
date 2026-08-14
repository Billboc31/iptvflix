import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { FastifyInstance } from 'fastify'

const exec = promisify(execFile)

async function runCmd(cmd: string, args: string[]): Promise<Record<string, unknown>> {
  try {
    const { stdout, stderr } = await exec(cmd, args, { timeout: 10_000 })
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & { stdout?: string; stderr?: string; signal?: string }
    return {
      ok: false,
      code: e.code,
      signal: e.signal,
      stdout: (e.stdout ?? '').trim(),
      stderr: (e.stderr ?? '').trim(),
      message: e.message,
    }
  }
}

function checkTmpDir(): Record<string, unknown> {
  try {
    const dir = mkdtempSync(join(tmpdir(), 'iptvflix-diag-'))
    rmSync(dir, { recursive: true })
    return { ok: true, tmpdir: tmpdir() }
  } catch (err: unknown) {
    const e = err as Error
    return { ok: false, error: e.message, tmpdir: tmpdir() }
  }
}

// Temporary diagnostic route — guarded by RAILWAY_ENVIRONMENT, removed in the correction ticket.
export async function diagnosticsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/diagnostics/env', async (_request, reply) => {
    if (!process.env.RAILWAY_ENVIRONMENT) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const [ffmpegWhich, ffmpegVersion, ffprobeWhich, ffprobeVersion] = await Promise.all([
      runCmd('which', ['ffmpeg']),
      runCmd('ffmpeg', ['-version']),
      runCmd('which', ['ffprobe']),
      runCmd('ffprobe', ['-version']),
    ])

    return reply.status(200).send({
      timestamp: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      resolvedPath: process.env.PATH ?? null,
      railwayEnvironment: process.env.RAILWAY_ENVIRONMENT,
      ffmpegWhich,
      ffmpegVersion,
      ffprobeWhich,
      ffprobeVersion,
      tmpDirWritable: checkTmpDir(),
      memoryUsage: process.memoryUsage(),
    })
  })
}
