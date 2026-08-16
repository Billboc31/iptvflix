import type { AvailabilityVariantResponse, DeliveryMode } from '@iptvflix/api-contracts';
type Status = 'idle' | 'loading' | 'ready' | 'error';
export type UsePlaybackState = {
    gatewayUrl: string | null;
    deliveryMode: DeliveryMode | null;
    containerExtension: string | null;
    startPositionSeconds: number;
    alternatives: AvailabilityVariantResponse[];
    availabilityId: string | null;
    status: Status;
    error: string | null;
    switchVariant: (id: string) => void;
};
export declare function usePlayback(mediaType: 'movie' | 'episode', mediaId: string, initialAvailabilityId?: string): UsePlaybackState;
export {};
//# sourceMappingURL=usePlayback.d.ts.map