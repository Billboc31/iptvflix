import { useCallback, useEffect, useState } from 'react';
import { resolvePlayback, ApiError } from '../lib/api.js';
export function usePlayback(mediaType, mediaId, initialAvailabilityId) {
    const [streamUrl, setStreamUrl] = useState(null);
    const [startPositionSeconds, setStartPositionSeconds] = useState(0);
    const [alternatives, setAlternatives] = useState([]);
    const [availabilityId, setAvailabilityId] = useState(initialAvailabilityId ?? null);
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState(null);
    const resolve = useCallback(async (explicitId) => {
        setStatus('loading');
        setError(null);
        try {
            const session = await resolvePlayback(mediaType, mediaId, explicitId ? { availabilityId: explicitId } : {});
            setStreamUrl(session.streamUrl);
            setStartPositionSeconds(session.startPositionSeconds);
            setAlternatives(session.alternatives);
            setAvailabilityId(session.availabilityId);
            setStatus('ready');
        }
        catch (err) {
            const message = err instanceof ApiError ? err.message : 'Impossible de démarrer la lecture.';
            setError(message);
            setStatus('error');
        }
    }, [mediaType, mediaId]);
    useEffect(() => {
        resolve(initialAvailabilityId);
    }, [resolve, initialAvailabilityId]);
    const switchVariant = useCallback((id) => {
        resolve(id);
    }, [resolve]);
    return { streamUrl, startPositionSeconds, alternatives, availabilityId, status, error, switchVariant };
}
//# sourceMappingURL=usePlayback.js.map