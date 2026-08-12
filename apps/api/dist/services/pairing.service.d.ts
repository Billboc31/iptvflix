import { devices } from '../db/schema/index.js';
import type { PairingCodeResponse, PairingStatusResponse, PairingCodeDetailResponse } from '@iptvflix/api-contracts';
export declare function generateDeviceToken(): string;
export declare function hashToken(token: string): string;
export declare function createPairingCode(): Promise<PairingCodeResponse>;
export declare function getPairingCodeDetail(code: string): Promise<PairingCodeDetailResponse>;
export declare function getPairingStatus(code: string): Promise<PairingStatusResponse>;
export declare function approvePairingCode(code: string, deviceName?: string): Promise<{
    device: typeof devices.$inferSelect;
    deviceToken: string;
}>;
export declare class PairingCodeNotFoundError extends Error {
    readonly statusCode = 404;
    constructor(code: string);
}
export declare class PairingCodeAlreadyApprovedError extends Error {
    readonly statusCode = 409;
    constructor(code: string);
}
//# sourceMappingURL=pairing.service.d.ts.map