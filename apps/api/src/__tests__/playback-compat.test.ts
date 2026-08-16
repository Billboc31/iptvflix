import { describe, it, expect } from 'vitest'
import { classifyDelivery, buildFfmpegArgs } from '../services/playback-compat.js'
import type { DeliveryMode } from '../services/playback-compat.js'

describe('classifyDelivery', () => {
  function info(videoCodec: string, audioCodec: string, containerFormat: string) {
    return { videoCodec, audioCodec, containerFormat }
  }

  it('H.264 + AAC + MP4 → DIRECT', () => {
    expect(classifyDelivery(info('h264', 'aac', 'mov,mp4,m4a,3gp,3g2,mj2'))).toBe<DeliveryMode>('DIRECT')
  })

  it('H.264 + AAC + M4V container → DIRECT', () => {
    expect(classifyDelivery(info('h264', 'aac', 'm4v'))).toBe<DeliveryMode>('DIRECT')
  })

  it('H.264 + AAC + MKV → HLS_REMUX', () => {
    expect(classifyDelivery(info('h264', 'aac', 'matroska,webm'))).toBe<DeliveryMode>('HLS_REMUX')
  })

  it('H.264 + AAC + MPEG-TS → HLS_REMUX', () => {
    expect(classifyDelivery(info('h264', 'aac', 'mpegts'))).toBe<DeliveryMode>('HLS_REMUX')
  })

  it('H.264 + AC3 (non-AAC audio) → HLS_TRANSCODE_AUDIO', () => {
    expect(classifyDelivery(info('h264', 'ac3', 'mpegts'))).toBe<DeliveryMode>('HLS_TRANSCODE_AUDIO')
  })

  it('H.264 + EAC3 → HLS_TRANSCODE_AUDIO', () => {
    expect(classifyDelivery(info('h264', 'eac3', 'matroska,webm'))).toBe<DeliveryMode>('HLS_TRANSCODE_AUDIO')
  })

  it('HEVC + AAC → HLS_TRANSCODE_FULL (non-H264 video)', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'matroska,webm'))).toBe<DeliveryMode>('HLS_TRANSCODE_FULL')
  })

  it('HEVC + AAC + MP4 → HLS_TRANSCODE_FULL (browser support not universal)', () => {
    expect(classifyDelivery(info('hevc', 'aac', 'mov,mp4,m4a,3gp,3g2,mj2'))).toBe<DeliveryMode>('HLS_TRANSCODE_FULL')
  })

  it('HEVC + AC3 → HLS_TRANSCODE_FULL', () => {
    expect(classifyDelivery(info('hevc', 'ac3', 'matroska,webm'))).toBe<DeliveryMode>('HLS_TRANSCODE_FULL')
  })

  it('VP9 + AAC → HLS_TRANSCODE_FULL', () => {
    expect(classifyDelivery(info('vp9', 'aac', 'matroska,webm'))).toBe<DeliveryMode>('HLS_TRANSCODE_FULL')
  })

  it('VP9 + Vorbis → HLS_TRANSCODE_FULL', () => {
    expect(classifyDelivery(info('vp9', 'vorbis', 'matroska,webm'))).toBe<DeliveryMode>('HLS_TRANSCODE_FULL')
  })

  it('AV1 + Opus → HLS_TRANSCODE_FULL', () => {
    expect(classifyDelivery(info('av1', 'opus', 'matroska,webm'))).toBe<DeliveryMode>('HLS_TRANSCODE_FULL')
  })

  it('HLS container → DIRECT regardless of codecs', () => {
    expect(classifyDelivery(info('h264', 'aac', 'hls'))).toBe<DeliveryMode>('DIRECT')
  })

  it('m3u8 container → DIRECT', () => {
    expect(classifyDelivery(info('h264', 'aac', 'm3u8'))).toBe<DeliveryMode>('DIRECT')
  })
})

describe('buildFfmpegArgs', () => {
  const TEMP_DIR = '/tmp/iptvflix-hls-test'

  it('HLS_REMUX uses stream copy', () => {
    const args = buildFfmpegArgs('HLS_REMUX', TEMP_DIR)
    expect(args).toContain('-c')
    expect(args).toContain('copy')
    expect(args).not.toContain('libx264')
    expect(args).not.toContain('aac')
  })

  it('HLS_TRANSCODE_AUDIO copies video and transcodes audio to AAC', () => {
    const args = buildFfmpegArgs('HLS_TRANSCODE_AUDIO', TEMP_DIR)
    expect(args).toContain('-c:v')
    expect(args).toContain('copy')
    expect(args).toContain('-c:a')
    expect(args).toContain('aac')
    expect(args).not.toContain('libx264')
  })

  it('HLS_TRANSCODE_FULL transcodes video to H.264 and audio to AAC', () => {
    const args = buildFfmpegArgs('HLS_TRANSCODE_FULL', TEMP_DIR)
    expect(args).toContain('libx264')
    expect(args).toContain('aac')
    expect(args).toContain('-crf')
    expect(args).toContain('23')
  })

  it('DIRECT returns empty args (no ffmpeg needed)', () => {
    expect(buildFfmpegArgs('DIRECT', TEMP_DIR)).toEqual([])
  })

  it('all HLS modes produce HLS output flags', () => {
    const hlsModes: DeliveryMode[] = ['HLS_REMUX', 'HLS_TRANSCODE_AUDIO', 'HLS_TRANSCODE_FULL']
    for (const mode of hlsModes) {
      const args = buildFfmpegArgs(mode, TEMP_DIR)
      expect(args).toContain('-f')
      expect(args).toContain('hls')
      expect(args).toContain('-hls_time')
      expect(args).toContain('6')
      expect(args).toContain('-hls_list_size')
      expect(args).toContain('0')
      expect(args).toContain('-hls_flags')
      expect(args).toContain('delete_segments+append_list')
      expect(args).toContain('-hls_segment_filename')
      // Segment path and playlist path use the provided tempDir
      expect(args.some((a) => a.includes(TEMP_DIR))).toBe(true)
    }
  })

  it('HLS output args reference the provided tempDir', () => {
    const dir = '/custom/temp/dir'
    const args = buildFfmpegArgs('HLS_REMUX', dir)
    expect(args.some((a) => a.startsWith(dir))).toBe(true)
    // Playlist path is the last arg
    expect(args[args.length - 1]).toBe(`${dir}/master.m3u8`)
    // Segment filename contains %05d.ts pattern
    const segArg = args[args.indexOf('-hls_segment_filename') + 1]
    expect(segArg).toMatch(/seg%05d\.ts$/)
  })
})
