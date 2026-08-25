import { useState, useEffect } from 'react';
import { fetchShelf } from '../lib/api.js';
export function useShelf(id) {
    const [shelf, setShelf] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        fetchShelf(id)
            .then(setShelf)
            .catch((e) => setError(e))
            .finally(() => setLoading(false));
    }, [id]);
    return { shelf, loading, error };
}
//# sourceMappingURL=useShelf.js.map