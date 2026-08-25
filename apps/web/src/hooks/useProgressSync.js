import { useEffect, useRef, useCallback } from 'react';
import { upsertProgress, getStoredAuthToken } from '../lib/api.js';
import { useInteractionEvents } from './useInteractionEvents.js';
const DEBOUNCE_MS = 10_000;
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';
const MILESTONES = [10, 25, 50, 75, 90];
const COMPLETE_RATIO = 0.9;
const NEAR_END_S = 60;
const FLOOR_SLACK_S = 15;
function resolveDuration(video, stableDuration) {
    const videoDur = Number.isFinite(video.duration) ? Math.floor(video.duration) : 0;
    const stable = stableDuration != null && stableDuration > 0 ? Math.floor(stableDuration) : 0;
    const duration = Math.max(stable, videoDur);
    if (!duration || !Number.isFinite(duration))
        return null;
    if (duration < Math.floor(video.currentTime))
        return null;
    return duration;
}
function isNearEnd(currentTime, duration) {
    return currentTime >= duration * COMPLETE_RATIO || currentTime >= duration - NEAR_END_S;
}
export function useProgressSync(videoRef, mediaType, mediaId, enabled, stableDurationSeconds, sessionId, progressFloorSeconds = 0, positionBaseSeconds = 0) {
    const lastSentRef = useRef(0);
    const mediaTypeRef = useRef(mediaType);
    const mediaIdRef = useRef(mediaId);
    mediaTypeRef.current = mediaType;
    mediaIdRef.current = mediaId;
    const stableDurationRef = useRef(stableDurationSeconds);
    stableDurationRef.current = stableDurationSeconds;
    const floorRef = useRef(progressFloorSeconds);
    floorRef.current = progressFloorSeconds;
    const baseRef = useRef(positionBaseSeconds);
    baseRef.current = positionBaseSeconds;
    function clampedProgress(video, duration) {
        const progress = Math.floor(video.currentTime) + baseRef.current;
        const floor = floorRef.current;
        if (floor > 0 && progress < floor - FLOOR_SLACK_S)
            return null;
        return Math.min(Math.max(progress, 0), duration);
    }
    const { emit: emitEvent } = useInteractionEvents();
    const emittedMilestonesRef = useRef(new Set());
    // Reset milestones when media changes
    useEffect(() => {
        emittedMilestonesRef.current = new Set();
    }, [mediaId]);
    function checkMilestones(video) {
        const duration = resolveDuration(video, stableDurationRef.current);
        if (!duration || duration <= 0)
            return;
        const percent = Math.floor(((video.currentTime + baseRef.current) / duration) * 100);
        for (const threshold of MILESTONES) {
            if (percent >= threshold && !emittedMilestonesRef.current.has(threshold)) {
                emittedMilestonesRef.current.add(threshold);
                emitEvent({
                    eventType: `WATCHED_${threshold}_PERCENT`,
                    mediaType: mediaTypeRef.current,
                    mediaId: mediaIdRef.current,
                    sessionId: sessionId ?? undefined,
                    progressPercent: threshold,
                    positionMs: Math.floor(video.currentTime * 1000),
                    clientType: 'web',
                });
            }
        }
    }
    const flushProgress = useCallback(() => {
        const video = videoRef.current;
        if (!video)
            return;
        const effectiveDuration = resolveDuration(video, stableDurationRef.current);
        if (!effectiveDuration)
            return;
        const progressSeconds = clampedProgress(video, effectiveDuration);
        if (progressSeconds == null)
            return;
        lastSentRef.current = Date.now();
        upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
            progressSeconds,
            durationSeconds: effectiveDuration,
        }).catch(() => undefined);
    }, [videoRef]);
    useEffect(() => {
        if (!enabled)
            return;
        const video = videoRef.current;
        if (!video)
            return;
        function sendProgress() {
            if (!video)
                return;
            const effectiveDuration = resolveDuration(video, stableDurationRef.current);
            if (!effectiveDuration)
                return;
            checkMilestones(video);
            const progressSeconds = clampedProgress(video, effectiveDuration);
            if (progressSeconds == null)
                return;
            const now = Date.now();
            if (now - lastSentRef.current < DEBOUNCE_MS)
                return;
            lastSentRef.current = now;
            upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
                progressSeconds,
                durationSeconds: effectiveDuration,
            }).catch(() => undefined);
        }
        function sendFinal() {
            if (!video)
                return;
            const effectiveDuration = resolveDuration(video, stableDurationRef.current);
            if (!effectiveDuration || !isNearEnd(video.currentTime + baseRef.current, effectiveDuration))
                return;
            lastSentRef.current = Date.now();
            upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
                progressSeconds: effectiveDuration,
                durationSeconds: effectiveDuration,
            }).catch(() => undefined);
        }
        function onPause() {
            if (!video)
                return;
            const effectiveDuration = resolveDuration(video, stableDurationRef.current);
            if (!effectiveDuration)
                return;
            const progressSeconds = clampedProgress(video, effectiveDuration);
            if (progressSeconds == null)
                return;
            lastSentRef.current = Date.now();
            upsertProgress(mediaTypeRef.current, mediaIdRef.current, {
                progressSeconds,
                durationSeconds: effectiveDuration,
            }).catch(() => undefined);
        }
        function onBeforeUnload() {
            const v = videoRef.current;
            if (!v)
                return;
            const effectiveDuration = resolveDuration(v, stableDurationRef.current);
            if (!effectiveDuration)
                return;
            const progressSeconds = clampedProgress(v, effectiveDuration);
            if (progressSeconds == null)
                return;
            const token = getStoredAuthToken();
            // fetch with keepalive survives page close and supports auth headers
            fetch(`${API_BASE}/progress/${mediaTypeRef.current}/${mediaIdRef.current}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    progressSeconds,
                    durationSeconds: effectiveDuration,
                }),
                keepalive: true,
            }).catch(() => undefined);
        }
        video.addEventListener('timeupdate', sendProgress);
        video.addEventListener('ended', sendFinal);
        video.addEventListener('pause', onPause);
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => {
            video.removeEventListener('timeupdate', sendProgress);
            video.removeEventListener('ended', sendFinal);
            video.removeEventListener('pause', onPause);
            window.removeEventListener('beforeunload', onBeforeUnload);
        };
    }, [videoRef, enabled]);
    return { flushProgress };
}
//# sourceMappingURL=useProgressSync.js.map