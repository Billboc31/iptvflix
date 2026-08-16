import { useState, useCallback } from 'react';
import { sendPlayOnTvCommand } from '../lib/api.js';
import { isDeviceOnline } from './useDevices.js';
export function usePlayOnTv() {
    const [commandState, setCommandState] = useState('idle');
    const send = useCallback(async (device, payload) => {
        if (!isDeviceOnline(device)) {
            setCommandState('device-offline');
            return 'device-offline';
        }
        setCommandState('sending');
        try {
            await sendPlayOnTvCommand(device.id, payload);
            setCommandState('delivered');
            return 'delivered';
        }
        catch {
            setCommandState('failed');
            return 'failed';
        }
    }, []);
    const reset = useCallback(() => setCommandState('idle'), []);
    return { commandState, send, reset };
}
//# sourceMappingURL=usePlayOnTv.js.map