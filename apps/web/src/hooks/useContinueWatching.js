import { useState, useEffect } from 'react';
import { fetchContinueWatching, dismissContinueWatching } from '../lib/api.js';
import { useProfile } from '../context/ProfileContext.js';
export function useContinueWatching() {
    const { profileVersion } = useProfile();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [dismissError, setDismissError] = useState(null);
    const [dismissErrorFor, setDismissErrorFor] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setError(null);
        fetchContinueWatching()
            .then((next) => {
            if (!cancelled)
                setItems(next);
        })
            .catch((e) => {
            if (!cancelled)
                setError(e);
        })
            .finally(() => {
            if (!cancelled)
                setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [profileVersion]);
    async function dismissItem(mediaType, mediaId) {
        setDismissError(null);
        setDismissErrorFor(null);
        const previous = items;
        setItems((current) => current.filter((i) => !(i.mediaType === mediaType && i.mediaId === mediaId)));
        try {
            await dismissContinueWatching(mediaType, mediaId);
        }
        catch {
            setItems(previous);
            setDismissError('Erreur lors de la suppression');
            setDismissErrorFor(mediaId);
        }
    }
    return { items, loading, error, dismissItem, dismissError, dismissErrorFor };
}
//# sourceMappingURL=useContinueWatching.js.map