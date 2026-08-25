import { useState, useEffect, useCallback } from 'react';
import { fetchArrivals } from '../lib/api.js';
export function useArrivals(filter = 'unread') {
    const [arrivals, setArrivals] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tick, setTick] = useState(0);
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        fetchArrivals(filter)
            .then((result) => {
            if (!cancelled) {
                setArrivals(result);
                setIsLoading(false);
            }
        })
            .catch((err) => {
            if (!cancelled) {
                setError(err);
                setIsLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [filter, tick]);
    const refresh = useCallback(() => setTick((t) => t + 1), []);
    return { arrivals, isLoading, error, refresh };
}
//# sourceMappingURL=useArrivals.js.map