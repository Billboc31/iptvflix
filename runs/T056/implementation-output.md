All three fixes are applied correctly. Here's a summary of what changed:

---

## Changes applied

**3 files modified:**

| File | Fix |
|---|---|
| `command/CommandRepository.kt` | Removed fallback polling entirely. `commands()` now simply collects from `sseClient.commandStream()` with deduplication + revocation handling. Removed `POLL_INTERVAL_MS`, `SSE_MAX_FAILURES`, `pollCommands()`, and 4 unused imports (`delay`, `Json`, `jsonArray`, `jsonObject`). |
| `command/ReconnectBackoffTest.kt` | Replaced the invalid `"after 3 SSE failures repository switches to polling"` test with `"UnauthorizedException from SSE triggers onRevoked"` — tests real behavior observable with the actual `SseClient`. Also fixed `commandStream()` mock in the duplicate test to use `every` instead of `coEvery` (it's not a suspend function). |
| `player/PlayerViewModel.kt` | `selectTrack()`: `clearOverrides()` → `clearOverridesOfType(ref.group.type)` so selecting a subtitle track no longer wipes the audio override. `stop()`: added `NonCancellable` context to the `reportNow()` launch so the progress flush survives rapid stop-then-destroy sequences. |
