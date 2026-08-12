import { useState, useEffect } from 'react';
import { fetchContinueWatching } from '../lib/api.js';
export function useContinueWatching() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        fetchContinueWatching()
            .then(setItems)
            .catch((e) => setError(e))
            .finally(() => setLoading(false));
    }, []);
    return { items, loading, error };
}
//# sourceMappingURL=useContinueWatching.js.map