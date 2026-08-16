import type { MediaInfo } from './media-prober.js'

export type DeliveryMode = 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL'

export function classifyDelivery(mediaInfo: MediaInfo): DeliveryMode {
  const video = mediaInfo.videoCodec.toLowerCase()
  const audio = mediaInfo.audioCodec.toLowerCase()
  const container = mediaInfo.containerFormat.toLowerCase()

  // HLS streams can be served directly (native browser support or via HLS.js)
  if (container.includes('hls') || container === 'm3u8' || container === 'm3u') {
    return 'DIRECT'
  }

  const isH264 = video === 'h264'
  const isAAC = audio === 'aac'
  const isMp4Container = container.includes('mp4') || container.includes('mov') || container.includes('m4v')

  // H.264 + AAC in MP4 container: universally browser-native
  if (isH264 && isAAC && isMp4Container) return 'DIRECT'

  // H.264 + AAC in non-MP4 container: remux to HLS without re-encoding
  if (isH264 && isAAC) return 'HLS_REMUX'

  // H.264 video + non-AAC audio: copy video, transcode audio only
  if (isH264) return 'HLS_TRANSCODE_AUDIO'

  // Non-H264 video (HEVC, VP9, AV1, etc.): full transcode
  return 'HLS_TRANSCODE_FULL'
}

export function buildFfmpegArgs(mode: DeliveryMode, tempDir: string): string[] {
  const segmentPath = `${tempDir}/seg%05d.ts`
  const playlistPath = `${tempDir}/master.m3u8`

  const HLS_OUTPUT = [
    '-f', 'hls',
    '-hls_time', '6',
    '-hls_list_size', '0',
    '-hls_flags', 'delete_segments+append_list',
    '-hls_segment_filename', segmentPath,
    playlistPath,
  ]

  switch (mode) {
    case 'HLS_REMUX':
      return ['-c', 'copy', ...HLS_OUTPUT]
    case 'HLS_TRANSCODE_AUDIO':
      return ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', ...HLS_OUTPUT]
    case 'HLS_TRANSCODE_FULL':
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', ...HLS_OUTPUT]
    default:
      return []
  }
}
