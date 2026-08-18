All tests pass. The fix is a single-line change: `'not_started'` → `'unwatched'` in `vertical-slice.test.ts:516`, matching the actual return values of `computeWatchState`. 

**Results:**
- `vertical-slice.test.ts` — 14/14 ✅
- `playback-resolver.test.ts` — 35/35 ✅

**Remaining blocker (BLOCKER 2):** The E2E manual validation checklist in `runs/T109/implementation-output.md` still requires a human with a running dev server and real IPTV data. That cannot be resolved by code changes.
