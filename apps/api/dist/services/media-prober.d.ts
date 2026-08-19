export type MediaInfo = {
    videoCodec: string;
    audioCodec: string;
    containerFormat: string;
    durationSeconds: number | null;
};
export declare function probeMedia(url: string): Promise<MediaInfo>;
//# sourceMappingURL=media-prober.d.ts.map