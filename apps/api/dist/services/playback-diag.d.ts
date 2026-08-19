export type PlaybackDiagResult = {
    availabilityId: string;
    upstreamReachable: boolean | null;
    upstreamHttpStatus: number | null;
    upstreamContentType: string | null;
    upstreamIsMediaBody: boolean | null;
    upstreamRedirectFinalUrl: string | null;
    detectedContainer: string | null;
    detectedVideoCodec: string | null;
    detectedAudioCodec: string | null;
    deliveryMode: string | null;
    ffmpegAvailable: boolean;
    ffprobeAvailable: boolean;
    sessionActive: boolean;
    sessionId: string | null;
    manifestReady: boolean | null;
    segmentCount: number | null;
    lastFfmpegError: string | null;
};
/** Returns diagnostic info for a given availabilityId. Returns null if not found. */
export declare function getPlaybackDiag(availabilityId: string): Promise<PlaybackDiagResult | null>;
//# sourceMappingURL=playback-diag.d.ts.map