import { useCallback } from 'react'
import type { InteractionEventBody } from '@iptvflix/api-contracts'
import { batchRecordInteractionEvents } from '../lib/api.js'

// Fire-and-forget interaction event emission. Never throws, never blocks the caller.
export function useInteractionEvents() {
  const emit = useCallback((event: InteractionEventBody): void => {
    batchRecordInteractionEvents([{ ...event, occurredAt: event.occurredAt ?? new Date().toISOString() }]).catch(
      () => undefined,
    )
  }, [])

  const emitBatch = useCallback((events: InteractionEventBody[]): Promise<{ sessionId?: string | null }> => {
    const withTimestamp = events.map((e) => ({ ...e, occurredAt: e.occurredAt ?? new Date().toISOString() }))
    return batchRecordInteractionEvents(withTimestamp).catch(() => ({}))
  }, [])

  return { emit, emitBatch }
}
