import { useState, useEffect, useCallback } from 'react';
import { fetchWatchlist, addToWatchlist, removeFromWatchlist } from '../lib/api.js';
export function useWatchlist() {
    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        fetchWatchlist()
            .then(setEntries)
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
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
        }
        catch {
            setEntries((prev) => prev.filter((e) => e.id !== optimistic.id));
        }
    }, []);
    const remove = useCallback(async (mediaType, mediaId) => {
        // Optimistic remove; re-fetch on error to restore correct state
        setEntries((prev) => prev.filter((e) => !(e.mediaType === mediaType && e.mediaId === mediaId)));
        try {
            await removeFromWatchlist(mediaType, mediaId);
        }
        catch {
            fetchWatchlist().then(setEntries).catch(() => { });
        }
    }, []);
    return { entries, loading, add, remove };
}
//# sourceMappingURL=useWatchlist.js.map