import type { DeviceResponse } from '@iptvflix/api-contracts';
export declare function listDevices(): Promise<DeviceResponse[]>;
export declare function renameDevice(id: string, name: string): Promise<DeviceResponse>;
export declare function revokeDevice(id: string): Promise<void>;
export declare class DeviceNotFoundError extends Error {
    readonly statusCode = 404;
    constructor(id: string);
}
//# sourceMappingURL=device.service.d.ts.map