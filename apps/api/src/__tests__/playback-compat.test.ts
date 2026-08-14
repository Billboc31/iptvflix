import { describe, it, expect } from 'vitest'
import { isSafariOrIOS, classifyDelivery, buildFfmpegArgs } from '../services/playback-compat.js'
import type { DeliveryMode } from '../services/playback-compat.js'

const SAFARI_IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
const SAFARI_MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FIREFOX_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0'

describe('isSafariOrIOS', () => {
  it('detects iPhone UA', () => {
    expect(isSafariOrIOS(SAFARI_IOS_UA)).toBe(true)
  })

  it('detects iPad UA', () => {
    const ipadUA = 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    expect(isSafariOrIOS(ipadUA)).toBe(true)
  })

  it('detects Safari on macOS', () => {
    expect(isSafariOrIOS(SAFARI_MAC_UA)).toBe(true)
  })

  it('does not match Chrome (contains "safari" substring)', () => {
    expect(isSafariOrIOS(CHROME_UA)).toBe(false)
  })

  it('does not match Firefox', () => {
    expect(isSafariOrIOS(FIREFOX_UA)).toBe(false)
  })

  it('does not match empty string', () => {
    expect(isSafariOrIOS('')).toBe(false)
  })
})

describe('classifyDelivery', () => {
  function info(videoCodec: string, audioCodec: string, containerFormat: string) {
    return { videoCodec, audioCodec, containerFormat }
  }

  it('MP4 + H.264 + AAC → DIRECT', () => {
    expect(classifyDelivery(info('h264', 'aac', 'mov,mp4,m4a,3gp,3g2,mj2'), true)).toBe<DeliveryMode>('DIRECT')
  })

  it('MKV + H.264 + AAC → REMUX', () => {
    expect(classifyDelivery(info('h264', 'aac', 'matroska,webm'), true)).toBe<DeliveryMode>('REMUX')
  })

  it('TS + H.264 + AC3 → TRANSCODE_AUDIO', () => {
    expect(classifyDelivery(info('h264', 'ac3', 'mpegts'), true)).toBe<DeliveryMode>('TRANSCODE_AUDIO')
  })

  it('any + HEVC + AAC, non-Safari → TRANSCODE_VIDEO', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'matroska,webm'), false)).toBe<DeliveryMode>('TRANSCODE_VIDEO')
  })

  it('any + HEVC + AAC, Safari iOS → DIRECT', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'matroska,webm'), true)).toBe<DeliveryMode>('DIRECT')
  })

  it('any + HEVC + AC3, Safari → TRANSCODE_AUDIO (video stays, audio transcoded)', () => {
    expect(classifyDelivery(info('hevc', 'ac3', 'matroska,webm'), true)).toBe<DeliveryMode>('TRANSCODE_AUDIO')
  })

  it('any + VP9 + AAC → TRANSCODE_VIDEO', () => {
    expect(classifyDelivery(info('vp9', 'aac', 'matroska,webm'), true)).toBe<DeliveryMode>('TRANSCODE_VIDEO')
  })

  it('any + VP9 + Vorbis → TRANSCODE_FULL', () => {
    expect(classifyDelivery(info('vp9', 'vorbis', 'matroska,webm'), true)).toBe<DeliveryMode>('TRANSCODE_FULL')
  })

  it('HLS container → DIRECT regardless of codecs', () => {
    expect(classifyDelivery(info('h264', 'aac', 'hls'), true)).toBe<DeliveryMode>('DIRECT')
  })

  it('any + HEVC + AC3, non-Safari → TRANSCODE_FULL', () => {
    expect(classifyDelivery(info('hevc', 'ac3', 'matroska,webm'), false)).toBe<DeliveryMode>('TRANSCODE_FULL')
  })
})

describe('buildFfmpegArgs', () => {
  it('REMUX uses stream copy', () => {
    const args = buildFfmpegArgs('REMUX')
    expect(args).toContain('-c')
    expect(args).toContain('copy')
    expect(args).toContain('mp4')
    expect(args).not.toContain('libx264')
    expect(args).not.toContain('aac')
  })

  it('TRANSCODE_AUDIO copies video and transcodes audio', () => {
    const args = buildFfmpegArgs('TRANSCODE_AUDIO')
    expect(args).toContain('-c:v')
    expect(args).toContain('copy')
    expect(args).toContain('-c:a')
    expect(args).toContain('aac')
    expect(args).not.toContain('libx264')
  })

  it('TRANSCODE_VIDEO transcodes video and copies audio', () => {
    const args = buildFfmpegArgs('TRANSCODE_VIDEO')
    expect(args).toContain('libx264')
    expect(args).toContain('-c:a')
    expect(args).toContain('copy')
    expect(args).not.toContain('aac')
  })

  it('TRANSCODE_FULL transcodes both video and audio', () => {
    const args = buildFfmpegArgs('TRANSCODE_FULL')
    expect(args).toContain('libx264')
    expect(args).toContain('aac')
  })

  it('all modes produce fmp4-compatible movflags', () => {
    const modes: DeliveryMode[] = ['REMUX', 'TRANSCODE_AUDIO', 'TRANSCODE_VIDEO', 'TRANSCODE_FULL']
    for (const mode of modes) {
      const args = buildFfmpegArgs(mode)
      expect(args).toContain('frag_keyframe+empty_moov+default_base_moof')
      expect(args).toContain('-f')
      expect(args).toContain('mp4')
    }
  })
})
