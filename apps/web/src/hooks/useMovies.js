import { useState, useEffect, useCallback } from 'react';
import { listMovies } from '../lib/api.js';
export function useMovies(filters = {}) {
    const filtersKey = JSON.stringify(filters);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            setData(await listMovies(JSON.parse(filtersKey)));
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
        // filtersKey is the serialized representation of filters
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey]);
    useEffect(() => {
        refetch();
    }, [refetch]);
    return { data, loading, error, refetch };
}
//# sourceMappingURL=useMovies.js.map