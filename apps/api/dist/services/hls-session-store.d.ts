import type { ChildProcess } from 'node:child_process';
import type { DeliveryMode } from './playback-compat.js';
export declare const SEGMENT_RE: RegExp;
type HlsSessionEntry = {
    sessionId: string;
    tempDir: string;
    process: ChildProcess;
    createdAt: number;
    expiresAt: number;
    failed: boolean;
    failedReason?: string;
};
/**
 * Spawns an ffmpeg HLS session for a given playback session ID.
 * The same ID is used in both the playback session store and this store.
 */
export declare function createHlsSession(sessionId: string, providerUrl: string, mode: DeliveryMode, startPositionSeconds?: number): Promise<void>;
export declare function getHlsSession(sessionId: string): HlsSessionEntry | null;
export type PlaylistResult = {
    status: 'ok';
    content: string;
} | {
    status: 'not_ready';
} | {
    status: 'gone';
};
export declare function getPlaylist(sessionId: string): Promise<PlaylistResult>;
export declare function waitForPlaylist(sessionId: string, timeoutMs?: number): Promise<boolean>;
export type SegmentResult = {
    status: 'ok';
    filePath: string;
} | {
    status: 'not_ready';
} | {
    status: 'gone';
} | {
    status: 'invalid';
};
export declare function getSegment(sessionId: string, filename: string): Promise<SegmentResult>;
export declare function getHlsSessionInfo(sessionId: string): {
    tempDir: string;
    createdAt: number;
} | null;
export {};
//# sourceMappingURL=hls-session-store.d.ts.map