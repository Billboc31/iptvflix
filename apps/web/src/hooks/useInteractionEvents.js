import { useCallback } from 'react';
import { batchRecordInteractionEvents } from '../lib/api.js';
// Fire-and-forget interaction event emission. Never throws, never blocks the caller.
export function useInteractionEvents() {
    const emit = useCallback((event) => {
        batchRecordInteractionEvents([{ ...event, occurredAt: event.occurredAt ?? new Date().toISOString() }]).catch(() => undefined);
    }, []);
    const emitBatch = useCallback((events) => {
        const withTimestamp = events.map((e) => ({ ...e, occurredAt: e.occurredAt ?? new Date().toISOString() }));
        return batchRecordInteractionEvents(withTimestamp).catch(() => ({}));
    }, []);
    return { emit, emitBatch };
}
//# sourceMappingURL=useInteractionEvents.js.map