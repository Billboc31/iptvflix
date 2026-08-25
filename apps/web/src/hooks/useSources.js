import { useState, useEffect, useCallback } from 'react';
import { listSources, createSource, updateSource, deleteSource, testSource, } from '../lib/api.js';
export function useSources() {
    const [sources, setSources] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const refetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setSources(await listSources());
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
    const handleCreate = useCallback(async (body) => {
        const created = await createSource(body);
        setSources((prev) => (prev ? [...prev, created] : [created]));
        return created;
    }, []);
    const handleUpdate = useCallback(async (id, body) => {
        const updated = await updateSource(id, body);
        setSources((prev) => (prev ? prev.map((s) => (s.id === id ? updated : s)) : [updated]));
        return updated;
    }, []);
    const handleDelete = useCallback(async (id) => {
        await deleteSource(id);
        setSources((prev) => (prev ? prev.filter((s) => s.id !== id) : []));
    }, []);
    const handleTest = useCallback(async (id) => {
        return testSource(id);
    }, []);
    return {
        sources,
        loading,
        error,
        refetch,
        createSource: handleCreate,
        updateSource: handleUpdate,
        deleteSource: handleDelete,
        testSource: handleTest,
    };
}
//# sourceMappingURL=useSources.js.map