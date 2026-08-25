import type { InteractionEventBody } from '@iptvflix/api-contracts';
export declare function useInteractionEvents(): {
    emit: (event: InteractionEventBody) => void;
    emitBatch: (events: InteractionEventBody[]) => Promise<{
        sessionId?: string | null;
    }>;
};
//# sourceMappingURL=useInteractionEvents.d.ts.map