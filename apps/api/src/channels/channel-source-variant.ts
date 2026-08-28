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

function streamUrlTail(url: string): string | null {
  try {
    const pathname = new URL(url).pathname
    const segments = pathname.split('/').filter(Boolean)
    const last = segments[segments.length - 1]
    if (!last) return null
    const stripped = last.replace(/\.[a-z0-9]+$/i, '')
    if (stripped.length >= 3 && stripped.length <= 24) return stripped
  } catch {
    // ignore invalid URLs
  }
  return null
}

function includesInsensitive(haystack: string, needle: string): boolean {
  return haystack.toUpperCase().includes(needle.toUpperCase())
}

/** Unique human label for one channel_sources row (full provider name + disambiguation). */
export function buildChannelSourceDisplayLabel(
  row: ChannelSourceVariantInput,
  disambiguators: string[],
): string {
  const name = row.providerName.trim()
  if (disambiguators.length === 0) return name
  return `${name} · ${disambiguators.join(' · ')}`
}

function candidateDisambiguators(row: ChannelSourceVariantInput): string[] {
  const name = row.providerName.trim()
  const labelParts = [row.providerName, row.groupTitle ?? '', row.streamUrl]
  const out: string[] = []

  const tail = streamUrlTail(row.streamUrl)
  if (tail && !includesInsensitive(name, tail)) out.push(tail)

  const codec = inferChannelSourceCodec(labelParts)
  if (codec && !includesInsensitive(name, codec)) out.push(codec)

  const group = row.groupTitle?.trim()
  if (group && !includesInsensitive(name, group)) out.push(group)

  const provider = row.sourceDisplayName?.trim()
  if (provider && !includesInsensitive(name, provider)) out.push(provider)

  return out
}

export function assignChannelSourceDisplayLabels(
  rows: ChannelSourceVariantInput[],
): Map<string, string> {
  const byName = new Map<string, ChannelSourceVariantInput[]>()
  for (const row of rows) {
    const key = row.providerName.trim()
    const list = byName.get(key) ?? []
    list.push(row)
    byName.set(key, list)
  }

  const labels = new Map<string, string>()

  for (const [name, siblings] of byName) {
    if (siblings.length === 1) {
      labels.set(siblings[0]!.id, name)
      continue
    }

    const assigned = new Map<string, string>()
    for (const row of siblings) {
      const candidates = candidateDisambiguators(row)
      let disambiguators: string[] = []
      let label = buildChannelSourceDisplayLabel(row, disambiguators)
      let guard = 0
      while (
        [...assigned.values()].includes(label) &&
        guard <= candidates.length
      ) {
        disambiguators = candidates.slice(0, guard + 1)
        label = buildChannelSourceDisplayLabel(row, disambiguators)
        guard++
      }
      if ([...assigned.values()].includes(label)) {
        const idx = siblings.findIndex((s) => s.id === row.id) + 1
        label = buildChannelSourceDisplayLabel(row, [`#${idx}`])
      }
      assigned.set(row.id, label)
      labels.set(row.id, label)
    }
  }

  return labels
}

export function mapChannelSourceToVariant(
  row: ChannelSourceVariantInput,
  displayLabel?: string,
): AvailabilityVariantResponse {
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
    displayLabel: displayLabel ?? row.providerName.trim(),
  }
}

export function mapChannelSourcesToVariants(
  rows: ChannelSourceVariantInput[],
): AvailabilityVariantResponse[] {
  const labels = assignChannelSourceDisplayLabels(rows)
  return rows.map((row) => mapChannelSourceToVariant(row, labels.get(row.id)))
}
