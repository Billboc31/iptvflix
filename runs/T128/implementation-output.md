All 59 tests pass (13 movies-pool + 17 movies-snapshot + 14 home-pool + 15 home-snapshot). The fix was applied to both test files.

**Summary of changes:**

Two files modified — `movies-pool-service.test.ts` and `home-pool-service.test.ts`:

- In both `vi.mock` factory closures (lines 20–30 in each file): replaced arrow functions with regular `function` expressions in `mockImplementation` for `ShelfInstanceService` and `ShelfFatigueService`
- In both `beforeEach` blocks: same replacement for the `mockImplementation` calls that re-establish constructor mocks after `vi.resetAllMocks()`

Root cause: arrow functions cannot be called with `new` (they have no `[[Construct]]` slot), so Vitest 4 raises `TypeError: ... is not a constructor` whenever the production code does `new ShelfInstanceService(db)`. Regular `function` expressions are constructable.
