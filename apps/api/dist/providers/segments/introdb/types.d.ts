export interface IntroDbTimestamp {
    start: number;
    end: number;
}
export interface IntroDbSegmentResponse {
    intro?: IntroDbTimestamp;
    recap?: IntroDbTimestamp;
    outro?: IntroDbTimestamp;
    confidence?: number;
    submissionCount?: number;
    updatedAt?: string;
}
//# sourceMappingURL=types.d.ts.map