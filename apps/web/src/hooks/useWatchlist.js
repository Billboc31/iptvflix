import { useState, useEffect, useCallback } from 'react';
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '../lib/api.js';
import { useProfile } from '../context/ProfileContext.js';
import { useInteractionEvents } from './useInteractionEvents.js';
export function useWatchlist() {
    const { profileVersion } = useProfile();
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const { emit: emitEvent } = useInteractionEvents();
    useEffect(() => {
        setEntries([]);
        setLoading(true);
        fetchWatchlist()
            .then(setEntries)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [profileVersion]);
    const add = useCallback(async (mediaType, mediaId) => {
        const optimistic = {
            id: `optimistic-${mediaId}`,
            profileId: '',
            mediaType,
            mediaId,
            title: mediaId,
            posterUrl: null,
            addedAt: new Date().toISOString(),
        };
        setEntries((prev) => [optimistic, ...prev]);
        try {
            const created = await addToWatchlist({ mediaType, mediaId });
            setEntries((prev) => prev.map((e) => (e.id === optimistic.id ? created : e)));
            emitEvent({ eventType: 'MY_LIST_ADDED', mediaType, mediaId, clientType: 'web' });
        }
        catch {
            setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
        }
    }, [emitEvent]);
    const remove = useCallback(async (mediaType, mediaId) => {
        setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)));
        try {
            await removeFromWatchlist(mediaType, mediaId);
            emitEvent({ eventType: 'MY_LIST_REMOVED', mediaType, mediaId, clientType: 'web' });
        }
        catch {
            fetchWatchlist().then(setEntries).catch(() => { });
        }
    }, [emitEvent]);
    return { entries, loading, add, remove };
}
//# sourceMappingURL=useWatchlist.js.map