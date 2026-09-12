import { useEffect, useRef, useState } from 'react';
import { activeSegment, shouldAutoSkip, coversEnd } from '../lib/skip-policy.js';
/** Segment times are absolute; remux playback starts on a local timeline. */
export function useNeverStop(videoRef, segments, preferences, enabled, timelineOffsetSeconds, mediaKey, onNext, totalDurationSeconds) {
    const [active, setActive] = useState();
    const skipped = useRef(new Set());
    const next = useRef(onNext);
    next.current = onNext;
    useEffect(() => { skipped.current.clear(); setActive(undefined); }, [mediaKey]);
    const skip = (segment) => {
        const video = videoRef.current;
        const target = segment.endMs / 1000 - timelineOffsetSeconds;
        if (!video || target < 0)
            return false;
        // Seeking outside a remux's available timeline can stall playback indefinitely.
        for (let i = 0; i < video.seekable.length; i++) {
            if (target >= video.seekable.start(i) && target <= video.seekable.end(i)) {
                video.currentTime = target;
                return true;
            }
        }
        return false;
    };
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !enabled) {
            setActive(undefined);
            return;
        }
        const tick = () => {
            const segment = activeSegment(segments, (video.currentTime + timelineOffsetSeconds) * 1000);
            setActive(segment);
            if (!segment || video.paused || video.seeking || video.ended || !shouldAutoSkip(segment, preferences))
                return;
            const key = `${segment.type}:${segment.startMs}:${segment.endMs}`;
            if (preferences.neverStopMode && coversEnd(segment, segments, (totalDurationSeconds ?? NaN) * 1000) && next.current())
                return;
            if (!skipped.current.has(key) && skip(segment)) {
                skipped.current.add(key);
                setActive(undefined);
            }
        };
        const ended = () => { if (preferences.neverStopMode || preferences.autoplayNextEpisode)
            next.current(); };
        video.addEventListener('timeupdate', tick);
        video.addEventListener('playing', tick);
        video.addEventListener('ended', ended);
        return () => {
            video.removeEventListener('timeupdate', tick);
            video.removeEventListener('playing', tick);
            video.removeEventListener('ended', ended);
        };
    }, [enabled, segments, preferences, timelineOffsetSeconds, mediaKey, totalDurationSeconds]);
    return { active, skip };
}
//# sourceMappingURL=useNeverStop.js.map