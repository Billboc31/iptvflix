import { useState, useEffect, useCallback } from 'react';
import { listSeries } from '../lib/api.js';
export function useSeries(filters = {}) {
    const filtersKey = JSON.stringify(filters);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setData(await listSeries(JSON.parse(filtersKey)));
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filtersKey]);
    useEffect(() => {
        refetch();
    }, [refetch]);
    return { data, loading, error, refetch };
}
//# sourceMappingURL=useSeries.js.map