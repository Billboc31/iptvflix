import type { RawSegment } from '../providers/segments/types.js';
export interface ProvenanceEntry {
    provider: string;
    startMs: number;
    endMs: number;
    confidence?: number;
    submissionCount?: number;
}
export interface MergedSegment {
    type: RawSegment['type'];
    startMs: number;
    endMs: number;
    selectedProvider: string;
    selectionReason: string;
    provenance: ProvenanceEntry[];
}
export declare function mergeSegments(rawSegments: RawSegment[], providerPriority: string[]): MergedSegment[];
//# sourceMappingURL=segment-merger.d.ts.map