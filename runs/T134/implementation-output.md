`BUILD SUCCESSFUL` — all tests pass. Here's a summary of all changes made:

---

## Files modified

| File | Change |
|---|---|
| `livetv/LiveTvHomeViewModel.kt` | Changed from `AndroidViewModel` to `ViewModel`; `ChannelRepository` now injected as constructor parameter; `supervisorScope` added around parallel async calls (also fixes a production bug where `async` child failures bypassed the `try/catch`); added `companion object Factory`. |
| `livetv/LiveTvHomeScreen.kt` | Default `viewModel()` now passes `LiveTvHomeViewModel.factory(...)` so the factory is used; `pointerInput(onRetry)` → `pointerInput(Unit)` to avoid recreating the gesture handler on every recomposition. |
| `livetv/ChannelModels.kt` | Removed dead `ChannelListResponse` class. |
| `test/livetv/LiveTvHomeViewModelTest.kt` | Fully rewritten — now instantiates the real `LiveTvHomeViewModel` with a MockK-mocked `ChannelRepository`, sets `UnconfinedTestDispatcher` as Main in `@Before`/`@After`, and tests 5 real state-machine transitions: all-data Ready, all-empty Ready, one-section-empty Ready, unexpected-exception Error, and retry-after-error. |

**Bonus production fix**: the `supervisorScope` change also corrects a pre-existing bug where a catastrophic exception from any `async` child (e.g., a JSON parse failure that escaped the repository) would cancel sibling parallel requests and propagate unhandled through the parent job instead of being caught cleanly.
