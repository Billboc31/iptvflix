import { useState, useEffect } from 'react';
export function useSchedulerStatus() {
    const [status, setStatus] = useState(null);
    useEffect(() => {
        const base = import.meta.env.VITE_API_BASE ?? '/api';
        fetch(`${base}/scheduler/status`, { credentials: 'include' })
            .then((res) => (res.ok ? res.json() : null))
            .then((data) => {
            if (data)
                setStatus(data);
        })
            .catch(() => { });
    }, []);
    return status;
}
//# sourceMappingURL=useSchedulerStatus.js.map