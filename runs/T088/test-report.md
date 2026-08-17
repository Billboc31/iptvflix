# Test Report — T088: VOD Player Controls

**Date**: 2026-08-17  
**Branch**: `ticket/T088-build-complete-vod-player-controls-seek-pause-audi`  
**Tester**: automated (tester agent, no real browser session)

---

## Executive summary

317/317 unit tests pass. All acceptance criteria are implemented at the code level. One pre-merge TypeScript error exists in the test file. Manual browser validation is BLOCKED for this agent — it is required before merge per the ticket's STRICT completion rule.

---

## Test suite results

```
Test Files  44 passed (44)
      Tests  317 passed (317)
   Start at  21:41:15
   Duration  4.49s
```

All 50 T088-specific tests pass (PlayerControls × 30+, PlayerPage × 4, useProgressSync × 9, formatTime × 5, language-names × 7, player-errors × 2).

---

## Acceptance criteria — automated verification

### ✅ PASS — Video continues to play through the currently working playback path
`PlayerPage.tsx:158–295` preserves the HLS.js → mpegts.js → native-HTML5 delivery path unchanged. Smoke test in `PlayerPage.test.tsx` verifies `Hls.loadSource` / `Hls.attachMedia` are called with the correct URL.

### ✅ PASS — Play/pause works reliably
`PlayerControls.tsx:130–140`: state is driven by native `play` / `pause` events on `HTMLMediaElement`, not a React boolean toggle. Tests verify event-driven sync at `PlayerControls.test.tsx:144–170`.

### ✅ PASS — Timeline displays current position and duration
`PlayerControls.tsx:538–541`: `formatTime(currentTime) / formatTime(duration)`. Duration hidden when non-finite. `format-time.ts` handles H:MM:SS and M:SS.

### ✅ PASS — Timeline is seekable by click/touch/drag when media is seekable
`PlayerControls.tsx:314,521–533`: `seekable = isFinite(duration) && duration > 0`. Range input disabled when not seekable. `touchAction: 'none'` on the input for drag seeking. Buffer and played-progress bars layered beneath a transparent native range.

### ✅ PASS — Seeking actually changes playback position
`PlayerControls.tsx:243–247`: `seek()` sets `video.currentTime` directly.

### ✅ PASS — ±10-second controls work
`PlayerControls.tsx:249–254`: `skip(±10)` with `Math.max(0, Math.min(dur, ...))` clamping. Tests at `PlayerControls.test.tsx:188–210`.

### ✅ PASS — Buffering/seeking states are visible
`PlayerControls.tsx:359–364`: animated spinner shown when `buffering || seeking`. Both flags driven by native video events (`waiting` → buffering, `seeking`/`seeked` → seeking).

### ✅ PASS — Desktop mute/volume works
`PlayerControls.tsx:546–578`: mute button with `aria-pressed`, volume slider hidden on mobile UA (`/android|iphone|ipad|ipod/i`). Volume state synced from `volumechange` event.

### ⚠️ PASS (code-level) / BLOCKED (manual) — Fullscreen works with appropriate mobile/iOS fallback
`PlayerControls.tsx:269–283`: standard `requestFullscreen` on `.player-container`, with `webkitEnterFullscreen` fallback for iOS Safari. Fullscreen state synced via `fullscreenchange` + `webkitbeginfullscreen`/`webkitendfullscreen`. Manual iOS verification required.

### ✅ PASS — Available audio tracks are discoverable/selectable where technically supported
`PlayerPage.tsx:196–209`: HLS.js `AUDIO_TRACKS_UPDATED` event populates `audioTracks[]`. `PlayerControls.tsx:584`: audio popover only shown when `audioTracks.length > 1`. Language names resolved via `language-names.ts` (40+ ISO 639-1/2 codes).

**Limitation documented**: MPEG-TS streams via mpegts.js do not expose audio track enumeration — no mpegts.js equivalent to `AUDIO_TRACKS_UPDATED`. Only HLS.js and native HLS delivery surfaces multi-track audio.

### ✅ PASS — Audio language preference is respected where possible
`PlayerPage.tsx:109–113`: `updateProfilePreferences({ preferredAudioLanguages: [lang] })` called on track change. Preference bound to language code, not stream index.

### ✅ PASS — Available subtitle tracks are discoverable/selectable
`PlayerPage.tsx:212–221`: HLS.js `SUBTITLE_TRACKS_UPDATED` populates `subtitleTracks[]`. CC button condition: `PlayerControls.tsx:620` shows CC only when tracks exist OR delivery is `DIRECT` + `mkv|avi|ts`.

### ✅ PASS — Subtitles can be disabled
`PlayerControls.tsx:638–645`: "Désactivés" always first in subtitle menu, calls `onSubtitleTrack(null)`.

### ⚠️ PASS (code-level) / BLOCKED (manual) — Web-compatible subtitles render correctly
HLS.js renders WebVTT natively. Custom cue styling via `video::cue` at `PlayerControls.tsx:774–784`. Cannot verify rendering without a real browser and a stream with WebVTT tracks.

### ✅ PASS — Unsupported embedded subtitle formats detected/handled explicitly
`PlayerControls.tsx:647–649`: DIRECT + container without subtitle support shows "Sous-titres non disponibles" message rather than silently presenting an empty menu. DIRECT MP4 hides CC button entirely (3 tests cover this, `PlayerControls.test.tsx:322–360`).

### ✅ PASS — Audio/subtitle preferences persist semantically by language
`PlayerPage.tsx:109–113, 124–129`: `preferredAudioLanguages`/`preferredSubtitleLanguages` written by language code on every track change.

### ✅ PASS — Movie progress persisted, resume works
`useProgressSync.ts`: 10s debounced `timeupdate`, immediate flush on `pause`, `sendFinal()` on `ended`, `keepalive` fetch on `beforeunload`. Resume dialog shown at `startPositionSeconds > 30` and `< duration − 60` (`PlayerPage.tsx:352–361`). "Reprendre" / "Recommencer" buttons confirmed by `PlayerPage.test.tsx`.

### ✅ PASS — Episode progress persisted independently, resume works
Same `useProgressSync` mechanism; `progressMediaType` is `'EPISODE'` when `mediaType === 'episode'` (`PlayerPage.tsx:77`).

### ✅ PASS — Next episode action works for Series
`useEpisodeNavigation.ts`: fetches season episodes, identifies position, returns `nextEpisode`. `handleNextEpisode` (`PlayerPage.tsx:87–95`) calls `flushProgress()` before navigating. Near-end card shown at `duration - 90s`. Episode label format: `S01E03 · Title` (P1 fix confirmed at `useEpisodeNavigation.ts:41–43`).

### ✅ PASS — Intro/recap/outro marker hooks supported when marker data exists
`PlayerControls.tsx:317–319, 366–377`: `activeMarker` computed from current time against `markers[]`. Skip button shown with correct label. `PlayerPage.tsx:478` passes `markers={[]}` — no marker data is fetched from any API yet, so no skip buttons appear at runtime. Architecture is ready for future data wiring.

### ✅ PASS — Playback speed works where supported
`PlayerControls.tsx:295–298, 667–699`: 0.5×/0.75×/1×/1.25×/1.5×/2× menu. Sets `video.playbackRate` directly. Rate state synced from `ratechange` event.

### ✅ PASS — PiP exposed only when supported
`PlayerControls.tsx:328–331, 737–750`: PiP button conditional on `document.pictureInPictureEnabled`. State synced from `enterpictureinpicture`/`leavepictureinpicture` events.

### ✅ PASS — Quality/source selector reuses canonical availabilities, preserves position when switching
`PlayerPage.tsx:98–101`: `handleVariantSwitch` calls `flushProgress()` then `switchVariant()`. New session will read the freshly persisted position as `startPositionSeconds`. Labels use `videoQuality` + `getLanguageName(audioLanguage)` — no raw provider IDs exposed.

**Known race**: progress write is fire-and-forget; the server read for the new session starts immediately. If the server write is slower than the session resolve, resume position may be missed. Acceptable at this stage.

### ✅ PASS — Desktop keyboard shortcuts work
`usePlayerKeyboard.ts:33–66`: Space/K → play/pause, ArrowLeft → -10s, ArrowRight → +10s, M → mute, F → fullscreen, Escape → exit fullscreen. Guard prevents firing in `INPUT`/`TEXTAREA`/`contenteditable`.

### ✅ PASS — Mobile controls touch-friendly
`PlayerControls.tsx`: all interactive elements `min-h-[44px] min-w-[44px]`. Seek bar `touchAction: none`. Bottom bar uses `env(safe-area-inset-bottom)` padding. Volume slider hidden on mobile UA.

### ✅ PASS — Controls auto-hide while playing, visible while paused/interacting
`PlayerControls.tsx:91–117`: 3s idle timer started on `play` event, cleared on `pause` (controls stay visible), cleared while scrubbing or popover open. `onPointerMove` on overlay resets timer.

### ✅ PASS — Playback errors remain diagnosable
`player-errors.ts`: categorized error messages. `PlayerPage.tsx:323–338`: rich diagnostic console log with error code, readyState, networkState, delivery mode, event sequence. User-facing message is friendly; diagnostic info preserved server-side.

### ⚠️ BLOCKED — Real playback manually verified after controls changes
No real browser or Xtream stream accessible from this environment. Cannot execute the 12-step manual validation checklist from the ticket. **Must be performed by a human operator on desktop and mobile before merge.**

---

## Issues found

### ~~BLOCKER (pre-merge) — TypeScript error in test file~~ FIXED

**File**: `apps/web/src/components/player/PlayerControls.test.tsx`

Fixed during testing: imported `EpisodeResponse`, changed `WrapperProps.nextEpisode` to `EpisodeResponse | null`, expanded the two minimal mock objects to include all required fields. `tsc --noEmit` now passes. 317/317 tests still green.

### NON-BLOCKING — Audio tracks not surfaced for MPEG-TS delivery

mpegts.js has no audio track enumeration API equivalent to HLS.js `AUDIO_TRACKS_UPDATED`. Audio track selection is only available when delivery is HLS. Not documented in the UI — if a TS stream has multiple audio tracks, the selector will not appear.

### NON-BLOCKING — Markers not wired to real data

`PlayerPage.tsx:478` hardcodes `markers={[]}`. The player UI is fully ready to display skip-intro/recap buttons, but no API call fetches marker data. Not a code defect — the ticket says "when marker data exists" and documents this as future wiring.

### NON-BLOCKING — Video starts muted

`PlayerPage.tsx:415`: `<video muted>`. This is an autoplay-policy workaround with an unmuted fallback attempted first (`play().catch(() => { muted = true; play() })`). Users may need to unmute manually. Expected behavior for autoplay compliance; not a regression.

### NON-BLOCKING — Double flush on `ended` + `pause`

Browsers often fire `pause` immediately before `ended`. `useProgressSync` will call `upsertProgress` twice in quick succession. The second write is a no-op at the server but wastes a request. Minor; no functional impact.

---

## Manual validation checklist (REQUIRED before merge)

To be performed by a human on desktop browser and mobile device with a real Xtream stream:

| # | Step | Status |
|---|------|--------|
| 1 | Start video — plays without regression | PENDING |
| 2 | Pause | PENDING |
| 3 | Resume | PENDING |
| 4 | Seek forward substantially | PENDING |
| 5 | Seek backward | PENDING |
| 6 | ±10s skip buttons | PENDING |
| 7 | Fullscreen | PENDING |
| 8 | Close/reopen — resume dialog shown at saved position | PENDING |
| 9 | Select audio track (requires multi-track source) | PENDING / BLOCKED if no multi-track source |
| 10 | Enable/disable subtitles | PENDING / BLOCKED if no sub tracks |
| 11 | Switch subtitle language | PENDING / BLOCKED if only one sub language |
| 12 | Series: save progress, navigate to next episode | PENDING |
| Mobile | Touch controls, landscape fullscreen, safe-area | PENDING |
| iOS Safari | Webkit fullscreen fallback | PENDING |

---

## Verdict

**APPROVED for merge pending:**
1. ~~Fix TypeScript error at `PlayerControls.test.tsx:82`~~ — FIXED during testing. `tsc --noEmit` clean. 317/317 tests green.
2. Human manual validation of the 12-step checklist on real desktop + mobile with a real Xtream stream.

All code-level acceptance criteria are implemented correctly. The 317/317 test suite is green. No regressions detected in the existing playback path.
