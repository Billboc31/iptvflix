import { useEffect, useRef } from 'react';
import { upsertProgress } from '../lib/api.js';
const DEBOUNCE_MS = 10_000;
export function useProgressSync(videoRef, mediaType, mediaId, enabled) {
    const lastSentRef = useRef(0);
    useEffect(() => {
        if (!enabled)
            return;
        const video = videoRef.current;
        if (!video)
            return;
        function sendProgress() {
            if (!video || video.duration <= 0)
                return;
            const now = Date.now();
            if (now - lastSentRef.current < DEBOUNCE_MS)
                return;
            lastSentRef.current = now;
            upsertProgress(mediaType, mediaId, {
                progressSeconds: Math.floor(video.currentTime),
                durationSeconds: Math.floor(video.duration),
            }).catch(() => undefined);
        }
        function sendFinal() {
            if (!video || video.duration <= 0)
                return;
            lastSentRef.current = Date.now();
            upsertProgress(mediaType, mediaId, {
                progressSeconds: Math.floor(video.duration),
                durationSeconds: Math.floor(video.duration),
            }).catch(() => undefined);
        }
        video.addEventListener('timeupdate', sendProgress);
        video.addEventListener('ended', sendFinal);
        return () => {
            video.removeEventListener('timeupdate', sendProgress);
            video.removeEventListener('ended', sendFinal);
        };
    }, [videoRef, mediaType, mediaId, enabled]);
}
//# sourceMappingURL=useProgressSync.js.map