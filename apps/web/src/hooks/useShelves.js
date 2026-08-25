import { useState, useEffect, useCallback } from 'react';
import { fetchShelves } from '../lib/api.js';
import { useProfile } from '../context/ProfileContext.js';
export function useShelves() {
    const { profileVersion } = useProfile();
    const [shelves, setShelves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setShelves(await fetchShelves());
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        setShelves([]);
        refetch();
    }, [refetch, profileVersion]);
    return { shelves, loading, error, refetch };
}
//# sourceMappingURL=useShelves.js.map