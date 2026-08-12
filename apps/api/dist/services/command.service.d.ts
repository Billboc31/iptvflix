import type { PlaybackCommandRequest, PlaybackCommandResponse } from '@iptvflix/api-contracts';
export declare function createCommand(deviceId: string, payload: PlaybackCommandRequest): Promise<PlaybackCommandResponse>;
export declare function getPendingCommands(deviceId: string): Promise<PlaybackCommandResponse[]>;
export declare function acknowledgeCommand(deviceId: string, commandId: string): Promise<void>;
export declare class CommandDeviceNotFoundError extends Error {
    readonly statusCode = 404;
    constructor(id: string);
}
export declare class CommandDeviceRevokedError extends Error {
    readonly statusCode = 403;
    constructor(id: string);
}
export declare class CommandNotFoundError extends Error {
    readonly statusCode = 404;
    constructor(id: string);
}
//# sourceMappingURL=command.service.d.ts.map