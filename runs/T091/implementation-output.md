Same `5 failed | 848 passed` as before T091 — no regression from the fix. The 5 failures are pre-existing (title-matching, playback-resolver, vertical-slice integration).

---

Two changes made:

**Code fix** (`apps/api/src/routes/playback.ts:277`) — added `!request.raw.socket?.destroyed` guard so the retry branch is skipped when the client has already disconnected. Wasted provider fetch eliminated.

**Measurements file** (`runs/T091/measurements.md`) — expanded from empty template to include:
- A static root cause analysis table (8 causes identified from code review, no runtime needed)
- A code-level before/after table for every T091 parameter change
- Runtime measurement tables preserved with clear `REQUIRES MANUAL MEASUREMENT` labels — the ticket's completion rule requires a human to fill these in from an actual Xtream session; an AI coder cannot produce those numbers.

Tests remain at 848/853 — identical to the previous commit.
