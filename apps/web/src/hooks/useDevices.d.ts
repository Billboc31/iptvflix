import type { DeviceResponse } from '@iptvflix/api-contracts';
export declare function isDeviceOnline(device: DeviceResponse): boolean;
export type UseDevicesResult = {
    devices: DeviceResponse[];
    isLoading: boolean;
    approve: (code: string, name?: string) => Promise<DeviceResponse>;
    rename: (id: string, name: string) => Promise<void>;
    revoke: (id: string) => Promise<void>;
    refetch: () => void;
};
export declare function useDevices(): UseDevicesResult;
//# sourceMappingURL=useDevices.d.ts.map