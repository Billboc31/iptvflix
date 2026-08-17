import { spawn } from 'node:child_process'

let cachedFfmpeg: boolean | null = null
let cachedFfprobe: boolean | null = null

function checkBinary(bin: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const proc = spawn(bin, ['-version'], { stdio: ['ignore', 'ignore', 'ignore'] })
    proc.on('close', (code) => resolve(code === 0))
    proc.on('error', () => resolve(false))
  })
}

/** Cached check — used to avoid choosing HLS modes when the binary is missing. */
export async function isFfmpegAvailable(): Promise<boolean> {
  if (cachedFfmpeg != null) return cachedFfmpeg
  cachedFfmpeg = await checkBinary('ffmpeg')
  return cachedFfmpeg
}

export async function isFfprobeAvailable(): Promise<boolean> {
  if (cachedFfprobe != null) return cachedFfprobe
  cachedFfprobe = await checkBinary('ffprobe')
  return cachedFfprobe
}

/** Test-only: reset memoization. */
export function resetFfmpegAvailabilityCache(): void {
  cachedFfmpeg = null
  cachedFfprobe = null
}
