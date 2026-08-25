import { useState, useEffect, useCallback } from 'react';
import { fetchFeedback, setFeedback, clearFeedback } from '../lib/api.js';
import { useInteractionEvents } from './useInteractionEvents.js';
export function useFeedback() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const { emit: emitEvent } = useInteractionEvents();
    useEffect(() => {
        fetchFeedback()
            .then(setEntries)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    const set = useCallback(async (mediaType, mediaId, feedback) => {
        setEntries((prev) => {
            const filtered = prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId));
            return [{ mediaType, mediaId, feedback, updatedAt: new Date().toISOString() }, ...filtered];
        });
        try {
            const updated = await setFeedback(mediaType, mediaId, { feedback });
            setEntries((prev) => prev.map((e) => (e.mediaType === mediaType && e.mediaId === mediaId ? updated : e)));
            if (feedback === 'LIKE') {
                emitEvent({ eventType: 'LIKED', mediaType, mediaId, clientType: 'web' });
            }
            else if (feedback === 'DISLIKE') {
                emitEvent({ eventType: 'DISLIKED', mediaType, mediaId, clientType: 'web' });
            }
        }
        catch {
            fetchFeedback().then(setEntries).catch(() => { });
        }
    }, [emitEvent]);
    const clear = useCallback(async (mediaType, mediaId) => {
        setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)));
        try {
            await clearFeedback(mediaType, mediaId);
        }
        catch {
            fetchFeedback().then(setEntries).catch(() => { });
        }
    }, []);
    const get = useCallback((mediaType, mediaId) => entries.find((e) => e.mediaType === mediaType && e.mediaId === mediaId), [entries]);
    return { entries, loading, set, clear, get };
}
//# sourceMappingURL=useFeedback.js.map