import { useState, useEffect, useCallback } from 'react';
import { listDevices, approvePairingCode, renameDevice, revokeDevice } from '../lib/api.js';
const ONLINE_THRESHOLD_MS = 90_000;
export function isDeviceOnline(device) {
    if (!device.lastSeenAt)
        return false;
    return Date.now() - new Date(device.lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}
export function useDevices() {
    const [allDevices, setAllDevices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const load = useCallback(() => {
        setIsLoading(true);
        listDevices()
            .then(setAllDevices)
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);
    useEffect(() => {
        load();
    }, [load]);
    const devices = allDevices.filter((d) => !d.revokedAt);
    const approve = useCallback(async (code, name) => {
        const device = await approvePairingCode(code, name);
        setAllDevices((prev) => [...prev, device]);
        return device;
    }, []);
    const rename = useCallback(async (id, name) => {
        const updated = await renameDevice(id, name);
        setAllDevices((prev) => prev.map((d) => (d.id === id ? updated : d)));
    }, []);
    const revoke = useCallback(async (id) => {
        await revokeDevice(id);
        setAllDevices((prev) => prev.filter((d) => d.id !== id));
    }, []);
    return { devices, isLoading, approve, rename, revoke, refetch: load };
}
//# sourceMappingURL=useDevices.js.map