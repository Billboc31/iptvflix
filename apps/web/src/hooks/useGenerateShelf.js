import { useState, useCallback } from 'react';
import { generateShelf } from '../lib/api.js';
export function useGenerateShelf() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const generate = useCallback(async (body) => {
        setLoading(true);
        setError(null);
        try {
            return await generateShelf(body);
        }
        catch (e) {
            setError(e);
            throw e;
        }
        finally {
            setLoading(false);
        }
    }, []);
    return { generate, loading, error };
}
//# sourceMappingURL=useGenerateShelf.js.map