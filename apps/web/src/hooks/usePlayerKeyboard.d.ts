import type { RefObject } from 'react';
type KeyboardHandlers = {
    togglePlay: () => void;
    seek: (seconds: number) => void;
    toggleMute: () => void;
    toggleFullscreen: () => void;
};
export declare function usePlayerKeyboard(videoRef: RefObject<HTMLVideoElement | null>, handlers: KeyboardHandlers): void;
export {};
//# sourceMappingURL=usePlayerKeyboard.d.ts.map