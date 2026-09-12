import { useCallback, useEffect, useState, useRef } from 'react';
import { resolvePlayback, ApiError } from '../lib/api.js';
export function usePlayback(mediaType, mediaId, initialAvailabilityId, startFresh = false) {
    const requestId = useRef(0);
    const [gatewayUrl, setGatewayUrl] = useState(null);
    const [deliveryMode, setDeliveryMode] = useState(null);
    const [containerExtension, setContainerExtension] = useState(null);
    const [startPositionSeconds, setStartPositionSeconds] = useState(0);
    const [alternatives, setAlternatives] = useState([]);
    const [availabilityId, setAvailabilityId] = useState(initialAvailabilityId ?? null);
    const [probeDurationSeconds, setProbeDurationSeconds] = useState(null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const resolve = useCallback(async (explicitId, restart = false) => {
        const currentRequest = ++requestId.current;
        setStatus('loading');
        setError(null);
        try {
            const session = await resolvePlayback(mediaType, mediaId, {
                ...(explicitId ? { availabilityId: explicitId } : {}),
                ...(restart ? { restart: true } : {}),
            });
            if (currentRequest !== requestId.current)
                return;
            setGatewayUrl(session.gatewayUrl);
            setDeliveryMode(session.deliveryMode);
            setContainerExtension(session.containerExtension);
            setStartPositionSeconds(session.startPositionSeconds);
            setAlternatives(session.alternatives);
            setAvailabilityId(session.availabilityId);
            setProbeDurationSeconds(session.probeResult?.durationSeconds ?? null);
            setStatus('ready');
        }
        catch (err) {
            if (currentRequest !== requestId.current)
                return;
            const message = err instanceof ApiError ? err.message : 'Impossible de démarrer la lecture.';
            setError(message);
            setStatus('error');
        }
    }, [mediaType, mediaId]);
    useEffect(() => {
        resolve(initialAvailabilityId, startFresh);
        return () => { requestId.current++; };
    }, [resolve, initialAvailabilityId, startFresh]);
    const switchVariant = useCallback((id) => {
        resolve(id);
    }, [resolve]);
    const restartPlayback = useCallback(() => {
        resolve(availabilityId ?? undefined, true);
    }, [resolve, availabilityId]);
    return { gatewayUrl, deliveryMode, containerExtension, startPositionSeconds, alternatives, availabilityId, probeDurationSeconds, status, error, switchVariant, restartPlayback };
}
//# sourceMappingURL=usePlayback.js.map