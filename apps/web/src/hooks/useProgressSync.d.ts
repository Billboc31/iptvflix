import type { RefObject } from 'react';
import type { ProgressMediaType } from '@iptvflix/api-contracts';
export declare function useProgressSync(videoRef: RefObject<HTMLVideoElement | null>, mediaType: ProgressMediaType, mediaId: string, enabled: boolean, stableDurationSeconds: number | null, sessionId?: string | null, progressFloorSeconds?: number, positionBaseSeconds?: number): {
    flushProgress: () => void;
};
//# sourceMappingURL=useProgressSync.d.ts.map