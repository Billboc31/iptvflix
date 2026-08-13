The 4 failing tests are the pre-existing `vertical-slice.test.ts` failures (unrelated to this ticket). All 706 other tests pass.

Fix applied: updated `scheduler-service.ts` to import `CatalogRefreshAlreadyRunningError` by value and use `instanceof` instead of checking `statusCode === 409`. Two lines changed, no behaviour change outside the now-correct `console.debug` path.
