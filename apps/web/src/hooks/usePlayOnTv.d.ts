import type { DeviceResponse, PlaybackCommandRequest } from '@iptvflix/api-contracts';
export type CommandState = 'idle' | 'sending' | 'delivered' | 'failed' | 'device-offline';
export type UsePlayOnTvResult = {
    commandState: CommandState;
    send: (device: DeviceResponse, payload: PlaybackCommandRequest) => Promise<CommandState>;
    reset: () => void;
};
export declare function usePlayOnTv(): UsePlayOnTvResult;
//# sourceMappingURL=usePlayOnTv.d.ts.map