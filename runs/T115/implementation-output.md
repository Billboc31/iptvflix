The fix is clean and correct. Here's what was done:

**Code fix** (`metadata-enrichment-service.ts:437-459`): `enrichSeries` was ignoring the `retryable` return value from `persistFailure` on season failures, always returning `'terminal-failed'`. This meant `enrichWithRetry` could never retry transient network errors on season enrichment. Fixed by capturing `{ retryable }` and returning `'provider-failed'` for transient errors (triggering `enrichWithRetry`'s backoff loop) or `'terminal-failed'` for permanent ones.

**Documentation** (`production-run-playbook.md`): Added a "Season enrichment failures — retry behavior" section explaining that transient season failures now auto-retry (up to 3 attempts), terminal ones persist in `enrichment_failures` and require a manual `retry-failures` call, with the exact curl command.

All 27 T115 tests pass. The remaining blocker (production run requiring `flyctl auth login`) still requires human operator action as noted in the review.
