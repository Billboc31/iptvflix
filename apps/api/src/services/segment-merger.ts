import type { RawSegment } from '../providers/segments/types.js'

const CLUSTER_TOLERANCE_MS = 2_000
const MIN_DURATION_MS = 5_000

export interface ProvenanceEntry {
  provider: string
  startMs: number
  endMs: number
  confidence?: number
  submissionCount?: number
}

export interface MergedSegment {
  type: RawSegment['type']
  startMs: number
  endMs: number
  selectedProvider: string
  selectionReason: string
  provenance: ProvenanceEntry[]
}

function formClusters(segments: RawSegment[]): RawSegment[][] {
  if (segments.length === 0) return []
  const sorted = [...segments].sort((a, b) => a.startMs - b.startMs)
  const clusters: RawSegment[][] = [[sorted[0]]]
  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i]
    const lastCluster = clusters[clusters.length - 1]
    const lastInCluster = lastCluster[lastCluster.length - 1]
    if (current.startMs - lastInCluster.startMs <= CLUSTER_TOLERANCE_MS) {
      lastCluster.push(current)
    } else {
      clusters.push([current])
    }
  }
  return clusters
}

function selectWinner(cluster: RawSegment[], providerPriority: string[]): RawSegment {
  return [...cluster].sort((a, b) => {
    const submA = a.submissionCount ?? 0
    const submB = b.submissionCount ?? 0
    if (submB !== submA) return submB - submA

    const confA = a.confidence ?? 0
    const confB = b.confidence ?? 0
    if (confB !== confA) return confB - confA

    const idxA = providerPriority.indexOf(a.sourceProvider)
    const idxB = providerPriority.indexOf(b.sourceProvider)
    const normA = idxA === -1 ? Infinity : idxA
    const normB = idxB === -1 ? Infinity : idxB
    return normA - normB
  })[0]
}

export function mergeSegments(
  rawSegments: RawSegment[],
  providerPriority: string[],
): MergedSegment[] {
  const result: MergedSegment[] = []

  const byType = new Map<string, RawSegment[]>()
  for (const seg of rawSegments) {
    const group = byType.get(seg.type) ?? []
    group.push(seg)
    byType.set(seg.type, group)
  }

  for (const [type, segs] of byType) {
    const clusters = formClusters(segs)

    for (const clusterSegs of clusters) {
      const winner = selectWinner(clusterSegs, providerPriority)
      const durationMs = winner.endMs - winner.startMs

      if (durationMs < MIN_DURATION_MS || winner.startMs >= winner.endMs) {
        console.warn(JSON.stringify({
          level: 'warn',
          event: 'segment_discarded_invalid_duration',
          type,
          startMs: winner.startMs,
          endMs: winner.endMs,
          durationMs,
        }))
        continue
      }

      const selectionReason = clusterSegs.length >= 2 ? 'cluster-consensus' : 'sole-provider'

      result.push({
        type: type as RawSegment['type'],
        startMs: winner.startMs,
        endMs: winner.endMs,
        selectedProvider: winner.sourceProvider,
        selectionReason,
        provenance: clusterSegs.map((s) => ({
          provider: s.sourceProvider,
          startMs: s.startMs,
          endMs: s.endMs,
          confidence: s.confidence,
          submissionCount: s.submissionCount,
        })),
      })
    }
  }

  return result
}
