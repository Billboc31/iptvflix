import { describe, it, expect, vi } from 'vitest'
import { mergeSegments } from '../segment-merger.js'
import type { RawSegment } from '../../providers/segments/types.js'

const PROVIDER_PRIORITY = ['introdb', 'theintrodb']

function makeSegment(overrides: Partial<RawSegment> & { type: RawSegment['type']; startMs: number; endMs: number; sourceProvider: string }): RawSegment {
  return {
    submissionCount: undefined,
    confidence: undefined,
    ...overrides,
  }
}

describe('mergeSegments()', () => {
  describe('cluster consensus', () => {
    it('clusters two providers within ±2s into one MergedSegment with both in provenance', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 82000, endMs: 142000, sourceProvider: 'introdb', submissionCount: 10 }),
        makeSegment({ type: 'INTRO', startMs: 81500, endMs: 142400, sourceProvider: 'theintrodb', submissionCount: 5 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('INTRO')
      expect(result[0].selectionReason).toBe('cluster-consensus')
      expect(result[0].provenance).toHaveLength(2)
      const providers = result[0].provenance.map((p) => p.provider)
      expect(providers).toContain('introdb')
      expect(providers).toContain('theintrodb')
    })

    it('selects the winner with the highest submissionCount within the cluster', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 80000, endMs: 140000, sourceProvider: 'introdb', submissionCount: 5 }),
        makeSegment({ type: 'INTRO', startMs: 81000, endMs: 141000, sourceProvider: 'theintrodb', submissionCount: 50 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result[0].selectedProvider).toBe('theintrodb')
      expect(result[0].startMs).toBe(81000)
    })

    it('tie-breaks by confidence when submissionCounts are equal', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 80000, endMs: 140000, sourceProvider: 'introdb', submissionCount: 10, confidence: 0.5 }),
        makeSegment({ type: 'INTRO', startMs: 81000, endMs: 141000, sourceProvider: 'theintrodb', submissionCount: 10, confidence: 0.9 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result[0].selectedProvider).toBe('theintrodb')
    })

    it('tie-breaks by providerPriority index when both submissionCount and confidence are equal', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 80000, endMs: 140000, sourceProvider: 'introdb', submissionCount: 10, confidence: 0.9 }),
        makeSegment({ type: 'INTRO', startMs: 81000, endMs: 141000, sourceProvider: 'theintrodb', submissionCount: 10, confidence: 0.9 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      // introdb has index 0 (lower = higher priority)
      expect(result[0].selectedProvider).toBe('introdb')
    })
  })

  describe('sole provider', () => {
    it('emits a sole-provider segment when only one provider has data', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 60000, endMs: 120000, sourceProvider: 'introdb', submissionCount: 5 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(1)
      expect(result[0].selectionReason).toBe('sole-provider')
      expect(result[0].selectedProvider).toBe('introdb')
      expect(result[0].provenance).toHaveLength(1)
    })

    it('emits sole-provider segments for multiple types', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 60000, endMs: 120000, sourceProvider: 'introdb' }),
        makeSegment({ type: 'RECAP', startMs: 0, endMs: 30000, sourceProvider: 'introdb' }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(2)
      expect(result.every((s) => s.selectionReason === 'sole-provider')).toBe(true)
    })
  })

  describe('provider disagreement', () => {
    it('emits two MergedSegments when providers disagree by more than 2s', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 80000, endMs: 140000, sourceProvider: 'introdb', submissionCount: 10 }),
        makeSegment({ type: 'INTRO', startMs: 84000, endMs: 144000, sourceProvider: 'theintrodb', submissionCount: 5 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      // Both clusters are emitted (>2s apart)
      expect(result).toHaveLength(2)
      expect(result.every((s) => s.selectionReason === 'sole-provider')).toBe(true)
    })
  })

  describe('duration sanity', () => {
    it('discards a segment shorter than 5s', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 60000, endMs: 63000, sourceProvider: 'introdb' }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(0)
    })

    it('discards a segment where startMs >= endMs', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 120000, endMs: 60000, sourceProvider: 'introdb' }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(0)
    })

    it('keeps segments with exactly 5s duration (boundary)', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 60000, endMs: 65000, sourceProvider: 'introdb' }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(1)
    })
  })

  describe('provenance', () => {
    it('preserves all provider entries with their timestamps in provenance', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 82000, endMs: 142000, sourceProvider: 'introdb', submissionCount: 10, confidence: 0.8 }),
        makeSegment({ type: 'INTRO', startMs: 81500, endMs: 142400, sourceProvider: 'theintrodb', submissionCount: 5 }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      const provenance = result[0].provenance

      const introdbEntry = provenance.find((p) => p.provider === 'introdb')!
      expect(introdbEntry.startMs).toBe(82000)
      expect(introdbEntry.endMs).toBe(142000)
      expect(introdbEntry.submissionCount).toBe(10)
      expect(introdbEntry.confidence).toBe(0.8)

      const theintrodbEntry = provenance.find((p) => p.provider === 'theintrodb')!
      expect(theintrodbEntry.startMs).toBe(81500)
      expect(theintrodbEntry.endMs).toBe(142400)
    })
  })

  describe('multi-type scenario', () => {
    it('returns one MergedSegment per distinct cluster across types', () => {
      const segments: RawSegment[] = [
        makeSegment({ type: 'INTRO', startMs: 60000, endMs: 120000, sourceProvider: 'introdb', submissionCount: 10 }),
        makeSegment({ type: 'INTRO', startMs: 60500, endMs: 120500, sourceProvider: 'theintrodb', submissionCount: 5 }),
        makeSegment({ type: 'CREDITS', startMs: 1380000, endMs: 1440000, sourceProvider: 'theintrodb', submissionCount: 8 }),
        makeSegment({ type: 'RECAP', startMs: 0, endMs: 45000, sourceProvider: 'introdb' }),
      ]
      const result = mergeSegments(segments, PROVIDER_PRIORITY)
      expect(result).toHaveLength(3)
      expect(result.find((s) => s.type === 'INTRO')?.selectionReason).toBe('cluster-consensus')
      expect(result.find((s) => s.type === 'CREDITS')?.selectionReason).toBe('sole-provider')
      expect(result.find((s) => s.type === 'RECAP')?.selectionReason).toBe('sole-provider')
    })
  })

  describe('empty input', () => {
    it('returns empty array for no segments', () => {
      expect(mergeSegments([], PROVIDER_PRIORITY)).toEqual([])
    })
  })
})
