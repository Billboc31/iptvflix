import type { MediaInfo } from './media-prober.js'

export type DeliveryMode = 'DIRECT' | 'REMUX' | 'TRANSCODE_AUDIO' | 'TRANSCODE_VIDEO' | 'TRANSCODE_FULL'

export function isSafariOrIOS(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return true
  // Safari on macOS: contains "safari" but not "chrome", "firefox", or "edg"
  if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('firefox') && !ua.includes('edg')) return true
  return false
}

export function classifyDelivery(mediaInfo: MediaInfo, isSafari: boolean): DeliveryMode {
  const video = mediaInfo.videoCodec.toLowerCase()
  const audio = mediaInfo.audioCodec.toLowerCase()
  const container = mediaInfo.containerFormat.toLowerCase()

  // HLS streams play natively in Safari
  if (container.includes('hls') || container === 'm3u8' || container === 'm3u') {
    return 'DIRECT'
  }

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

  // Unsupported video codec
  if (isAAC) return 'TRANSCODE_VIDEO'
  return 'TRANSCODE_FULL'
}

export function buildFfmpegArgs(mode: DeliveryMode): string[] {
  const OUTPUT_FLAGS = ['-movflags', 'frag_keyframe+empty_moov+default_base_moof', '-f', 'mp4', '-max_interleave_delta', '0']

  switch (mode) {
    case 'REMUX':
      return ['-c', 'copy', ...OUTPUT_FLAGS]
    case 'TRANSCODE_AUDIO':
      return ['-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', ...OUTPUT_FLAGS]
    case 'TRANSCODE_VIDEO':
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'copy', ...OUTPUT_FLAGS]
    case 'TRANSCODE_FULL':
      return ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-c:a', 'aac', '-b:a', '192k', ...OUTPUT_FLAGS]
    default:
      return []
  }
}
