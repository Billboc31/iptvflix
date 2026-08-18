The implementation is complete. Here's a summary of what changed:

**`apps/web/src/pages/PlayerPage.tsx`** — 73 lines changed:
- Added `startPositionRef` (parallel to `stableDurationRef`) to track `startPositionSeconds` without re-triggering the attach effect
- Guarded all 4 `video.play()` / `mpegtsPlayer.play()` calls in `attach()` — only fires immediately when `startPositionRef.current ≤ 30 s`; above that threshold, `onMetadata` becomes responsible
- Removed `autoPlay` from `<video>` — playback is now exclusively driven by code
- Updated `onMetadata`: else branch now always calls `video.play()` (with optional-chain for jsdom compat)
- Added Escape-key `useEffect` — closes dialog without starting playback
- Upgraded dialog panel with `role="dialog"`, `aria-modal`, `aria-labelledby`, `aria-describedby`
- Dialog heading shows `episodeLabel` for episodes, `"Reprendre la lecture ?"` for movies
- Added descriptive `<p id="resume-dialog-desc">Vous vous êtes arrêté à HH:MM:SS.</p>`
- Added `autoFocus` + `aria-label` on the primary Reprendre button
- Secondary button shows `"Recommencer l'épisode"` for episodes, `"Recommencer"` for movies

**`apps/web/src/pages/PlayerPage.test.tsx`** — 9 new test scenarios added (13 total, all pass)

**`apps/web/src/test/setup.ts`** — stubbed `HTMLMediaElement.prototype.play/pause` so jsdom tests don't throw
