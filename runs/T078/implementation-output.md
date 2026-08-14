The fix is clean and complete. Here's what changed in `apps/web/src/pages/PlayerPage.tsx`:

- **`useState` added** — `videoError: string | null` tracks stream-level errors as React state (not a ref)
- **Reset on new URL** — `setVideoError(null)` at the top of the load effect clears any previous error when a new gateway URL loads (e.g. variant switch)
- **`onError` now triggers re-render** — instead of `.catch(() => undefined)`, the HEAD check now chains `.then(() => setVideoError(...))` / `.catch(() => setVideoError(...))` so React actually re-renders; the `else` branch handles the case where `httpStatusRef.current` was already set synchronously
- **Error overlay rendered** — `{videoError && <ErrorState ...>}` displays above the video element; controls are hidden while the error is shown

The blocker identified in the review is resolved: gateway 401/404/504 errors during streaming and browser decode failures are now surfaced to the user rather than silently leaving an empty player.
