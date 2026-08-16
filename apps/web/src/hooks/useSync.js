import { useState, useEffect, useCallback } from 'react';
import { listSyncRuns, triggerSync } from '../lib/api.js';
const ACTIVE_STATUSES = new Set(['PENDING', 'RUNNING']);
export function useSync() {
    const [runs, setRuns] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = useCallback(async () => {
        try {
            setRuns(await listSyncRuns());
            setError(null);
        }
        catch (e) {
            setError(e);
        }
        finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => {
        refetch();
    }, [refetch]);
    // Auto-poll every 3 s while any run is PENDING or RUNNING
    useEffect(() => {
        const hasActive = runs?.some((r) => ACTIVE_STATUSES.has(r.status));
        if (!hasActive)
            return;
        const id = setInterval(refetch, 3000);
        return () => clearInterval(id);
    }, [runs, refetch]);
    const handleTrigger = useCallback(async (sourceId) => {
        const run = await triggerSync({ sourceId });
        setRuns((prev) => (prev ? [run, ...prev] : [run]));
        return run;
    }, []);
    return { runs, loading, error, refetch, triggerSync: handleTrigger };
}
//# sourceMappingURL=useSync.js.map