import { spawn } from 'node:child_process'

export type MediaInfo = {
  videoCodec: string
  audioCodec: string
  containerFormat: string
}

export async function probeMedia(url: string): Promise<MediaInfo> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      url,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })

    let stdout = ''
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    proc.stderr.on('data', () => {})

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}`))
        return
      }
      try {
        const data: { streams?: Array<{ codec_type: string; codec_name: string }>; format?: { format_name: string } } = JSON.parse(stdout)
        const streams = data.streams ?? []
        const video = streams.find((s) => s.codec_type === 'video')
        const audio = streams.find((s) => s.codec_type === 'audio')
        resolve({
          videoCodec: video?.codec_name ?? '',
          audioCodec: audio?.codec_name ?? '',
          containerFormat: data.format?.format_name ?? '',
        })
      } catch {
        reject(new Error('ffprobe output parse failed'))
      }
    })

    proc.on('error', reject)
  })
}
