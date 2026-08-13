Done. `close()` is now called immediately after `onRevoked()` in the `UnauthorizedException` catch block (`CommandRepository.kt:34`). This closes the `callbackFlow` channel on the producer side, which causes `awaitClose()` to return immediately rather than suspending indefinitely — fixing the deadlock in the test and correctly signaling flow termination in production (revocation is a terminal state, no further commands should arrive).

**File modified:** `apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/command/CommandRepository.kt` — 1 line added.
