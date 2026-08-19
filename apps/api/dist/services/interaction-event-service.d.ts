import type { InteractionEventBody } from '@iptvflix/api-contracts';
export declare const ALLOWED_EVENT_TYPES: Set<string>;
export declare function recordEvent(profileId: string, event: Omit<InteractionEventBody, 'profileId'>): Promise<void>;
export declare function recordEventBatch(profileId: string, events: Omit<InteractionEventBody, 'profileId'>[]): Promise<void>;
//# sourceMappingURL=interaction-event-service.d.ts.map