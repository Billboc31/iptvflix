import { useState, useEffect } from 'react';
import { fetchHome } from '../lib/api.js';
export function useHome(profileId) {
    const [data, setData] = useState(undefined);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    useEffect(() => {
        let cancelled = false;
        setIsLoading(true);
        setError(null);
        fetchHome(profileId)
            .then((result) => {
            if (!cancelled) {
                setData(result);
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
    }, [profileId]);
    return { data, isLoading, error };
}
//# sourceMappingURL=useHome.js.map