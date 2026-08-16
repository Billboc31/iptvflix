import { spawn } from 'node:child_process'

let cached: boolean | null = null

/** Cached check — used to avoid choosing HLS modes when the binary is missing. */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (cached != null) return cached
  cached = await new Promise<boolean>((resolve) => {
    const proc = spawn('ffmpeg', ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
  return cached
}

/** Test-only: reset memoization. */
export function resetFfmpegAvailabilityCache(): void {
  cached = null
}
