All 27 home tests pass (12 pool + 15 service). The three root causes were:

1. **`vi.clearAllMocks()` not clearing `mockReturnValueOnce` queue** → changed to `vi.resetAllMocks()`
2. **`vi.resetAllMocks()` clearing constructor `mockImplementation`** → re-establish `ShelfInstanceService` and `ShelfFatigueService` constructor mocks in `beforeEach`; without this, Rail 4 fails immediately, shifts the engine mock queue, and breaks all subsequent rails
3. **DB mock order wrong in freshness test** → `getFreshMediaIds` (Rail 3) hits the DB before `selectThematicConcept` (Rail 4), so fresh movies mock must be first in the queue

The 33 pre-existing failures in other test files are unrelated to this ticket.
