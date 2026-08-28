import type { AvailabilityVariantResponse } from '@iptvflix/api-contracts'

const QUALITY_4K = /\b(4k|uhd|2160p?)\b/i
const QUALITY_1080 = /\b(1080p?|fhd)\b/i
const QUALITY_720 = /\b(720p?|hd)\b/i
const QUALITY_480 = /\b(480p?|sd)\b/i
const CODEC_HEVC = /\b(hevc|h\.?265)\b/i
const CODEC_AVC = /\b(h\.?264|avc)\b/i

export function inferChannelSourceQuality(parts: string[]): string | null {
  const blob = parts.filter(Boolean).join(' ')
  if (QUALITY_4K.test(blob)) return '4K'
  if (QUALITY_1080.test(blob)) return '1080p'
  if (QUALITY_720.test(blob)) return '720p'
  if (QUALITY_480.test(blob)) return '480p'
  return null
}

export function inferChannelSourceCodec(parts: string[]): string | null {
  const blob = parts.filter(Boolean).join(' ')
  if (CODEC_HEVC.test(blob)) return 'HEVC'
  if (CODEC_AVC.test(blob)) return 'H.264'
  return null
}

export type ChannelSourceVariantInput = {
  id: string
  sourceId: string
  providerName: string
  groupTitle: string | null
  streamUrl: string
  status: 'AVAILABLE' | 'UNAVAILABLE'
  sourceDisplayName: string | null
}

export function mapChannelSourceToVariant(row: ChannelSourceVariantInput): AvailabilityVariantResponse {
  const labelParts = [row.providerName, row.groupTitle ?? '', row.streamUrl]
  const videoQuality = inferChannelSourceQuality(labelParts)
  const codecName = inferChannelSourceCodec(labelParts)
  return {
    id: row.id,
    status: row.status,
    providerId: row.sourceId,
    audioLanguage: null,
    subtitleLanguage: null,
    videoQuality,
    rawTitle: row.providerName,
    sourceDisplayName: row.sourceDisplayName,
    codecName,
    hdrFormat: null,
    releaseHint: row.groupTitle,
    audioFormat: null,
  }
}
