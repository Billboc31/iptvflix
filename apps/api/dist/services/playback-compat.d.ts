import type { MediaInfo } from './media-prober.js';
export type DeliveryMode = 'DIRECT' | 'HLS_REMUX' | 'HLS_TRANSCODE_AUDIO' | 'HLS_TRANSCODE_FULL';
export declare function classifyDelivery(mediaInfo: MediaInfo): DeliveryMode;
/** Insert ffmpeg `-ss` immediately before `-i` so remux/transcode starts at resume time. */
export declare function insertSeekBeforeInput(args: string[], startPositionSeconds: number): string[];
export declare function buildFfmpegArgs(mode: DeliveryMode, tempDir: string): string[];
//# sourceMappingURL=playback-compat.d.ts.map