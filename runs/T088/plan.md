## Objective
Implement a complete, production-grade VOD player UX on top of the currently working Xtream playback transport by adding all missing controls and behaviors (±10 s skip, audio/subtitle track selection, playback speed, Picture-in-Picture, keyboard shortcuts, resume dialog, episode navigation, skip-intro hooks, mobile touch improvements) and improving progress persistence, without touching the working playback architecture.

## Included

### Step 0 — Regression smoke test
- `apps/web/src/pages/PlayerPage.test.tsx` (new): stub HLS.js and assert `loadSource` is called with the correct gateway URL for the HLS delivery path. Document what cannot be unit-tested without a real browser runtime.

### Step 1 — PlayerControls: basic missing controls
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Add ±10 s skip buttons (Rewind 10 / Forward 10) in the bottom bar, clamped at `[0, duration]`.
- Add `seeking` state (listen to `seeking` / `seeked` video events) and show the buffering spinner during seek as well.
- Stop the auto-hide timer while the seek or volume input is being dragged (`pointerdown`/`pointerup`); restart on `pointerup`.
- Keep controls visible (no auto-hide) while paused.

### Step 2 — Keyboard shortcuts
**New file**: `apps/web/src/hooks/usePlayerKeyboard.ts`
- On `keydown` when no `<input>` / `<textarea>` / `[contenteditable]` has focus:
  - Space / K → toggle play/pause
  - ArrowLeft → seek −10 s
  - ArrowRight → seek +10 s
  - M → toggle mute
  - F → toggle fullscreen
  - Escape → exit fullscreen only (never close player)
- Wire into `PlayerControls` via `usePlayerKeyboard(videoRef, { togglePlay, seek, toggleMute, toggleFullscreen })`.

### Step 3 — Mobile / touch UX
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Replace `onMouseMove` with `onPointerMove` so touch reveals controls.
- Apply `touch-action: none` on the seek range to prevent scroll interference during drag.
- Apply `padding-bottom: env(safe-area-inset-bottom)` (or Tailwind `pb-safe` equivalent) to the bottom controls container.
- Minimum 44 px height for all icon buttons.
- Optional double-tap ±10 s zones on left/right thirds of video area, only if implementable without conflicting with single-tap show-controls.

### Step 4 — Fullscreen: iOS Safari fallback
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Detect `video.webkitSupportsFullscreen` (iPhone Safari).
- If standard `requestFullscreen` is unavailable and `webkitSupportsFullscreen` is true, call `video.webkitEnterFullscreen()` / `video.webkitExitFullscreen()`.
- Listen to `webkitbeginfullscreen` / `webkitendfullscreen` for fullscreen state sync.

### Step 5 — Resume dialog
**File**: `apps/web/src/pages/PlayerPage.tsx`
- When `startPositionSeconds > 30` and `startPositionSeconds < duration − 60`, show a blocking overlay before setting `currentTime`:
  ```
  Reprendre à 42:18    Recommencer
  ```
- "Reprendre" → apply `startPositionSeconds` (existing behavior).
- "Recommencer" → set `currentTime = 0`, discard saved position.
- Duration threshold values (30 s, 60 s) defined as named constants, not inline magic numbers.
- Do not show the dialog when `startPositionSeconds === 0` or duration is unknown.

### Step 6 — Progress persistence improvements
**File**: `apps/web/src/hooks/useProgressSync.ts`
- Add `pause` event listener that flushes progress immediately (bypasses the 10 s debounce).
- Add `window.addEventListener('beforeunload', ...)` that calls `navigator.sendBeacon` to persist progress on page close.
- Export a `flushProgress()` callback from the hook so callers can trigger an immediate save.

**File**: `apps/web/src/pages/PlayerPage.tsx`
- Call `flushProgress()` before switching variant or episode.

### Step 7 — Audio track selection
**Architecture decision (documented hypothesis)**:
- HLS.js exposes `hls.audioTracks` (array of `{id, name, lang}`) and `hls.audioTrack` (writable index) when the HLS manifest includes `#EXT-X-MEDIA` audio renditions.
- For `DIRECT` MP4/MKV: `HTMLMediaElement.audioTracks` is unsupported in Chromium as of 2025. Fall back to variant-level switching (already implemented).
- For `HLS_REMUX` / `HLS_TRANSCODE_AUDIO` / `HLS_TRANSCODE_FULL`: ffmpeg outputs single-audio HLS — no in-stream audio switching available; document as "language selected at variant resolution time".

**New file**: `apps/web/src/lib/language-names.ts`
- Map ISO 639-1/2 codes to display names (`fr` → `Français`, `en` → `English`, etc.).

**File**: `apps/web/src/pages/PlayerPage.tsx`
- Expose the HLS.js instance via a ref and pass audio track list + setter to `PlayerControls`.
- Listen to `Hls.Events.AUDIO_TRACKS_UPDATED` and `Hls.Events.AUDIO_TRACK_SWITCHED` to keep track state in sync.

**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Add props: `audioTracks: Array<{id: number, label: string, lang: string}>`, `currentAudioTrack: number`, `onAudioTrack: (id: number) => void`.
- Show Audio popover menu only when `audioTracks.length > 1`.
- Current track indicated with a checkmark. Language label via `language-names.ts`.

**Audio language preference persistence**:
- On track selection, call `PUT /profile/preferences` (identify existing endpoint in `apps/api/src/routes/profile.ts`) with updated `preferredAudioLanguages`.

### Step 8 — Subtitle discovery and selection
**Architecture decision (documented hypothesis)**:
- HLS.js: `hls.subtitleTracks` + `hls.subtitleTrack` (−1 = off) for HLS WebVTT renditions.
- Native HTML5 `video.textTracks`: iterate on `loadeddata` / `addtrack` events.
- Embedded SRT/ASS/PGS in MKV DIRECT streams: NOT renderable by browser — detect (`deliveryMode === 'DIRECT'` + container `mkv` + no WebVTT tracks found) and surface "Sous-titres non disponibles" in the menu rather than silently failing.

**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Add props: `subtitleTracks: Array<{id: number, label: string, lang: string}>`, `currentSubtitleTrack: number | null` (null = Off), `onSubtitleTrack: (id: number | null) => void`.
- Show Subtitles/CC popover only when at least one track exists.
- Always include "Désactivés" option (value null).

**Subtitle rendering**:
- For HLS.js WebVTT: use `hls.subtitleDisplay = true` (native text track rendering via HLS.js).
- Apply CSS `::cue` styles (white text, dark semi-transparent background, bottom-center placement, safe margin above controls) via a `<style>` tag injected once in `PlayerPage.tsx`.
- Embedded MKV subtitles (SRT/ASS/PGS): explicitly unsupported in this ticket; show status in menu.

**Subtitle language preference persistence**:
- Same pattern as audio: update `profile.preferredSubtitleLanguages` via `PUT /profile/preferences` on track selection.

### Step 9 — Series episode UX
**New file**: `apps/web/src/hooks/useEpisodeNavigation.ts`
- Fetch series episode list from the catalog API (identify correct endpoint, e.g., `/series/:seriesId/episodes`).
- Derive `previousEpisode` and `nextEpisode` from `mediaId`.
- Return `{ episodeLabel, nextEpisode, previousEpisode }`.

**File**: `apps/web/src/pages/PlayerPage.tsx`
- Wire `useEpisodeNavigation` for `mediaType === 'episode'`.
- Pass `episodeLabel`, `nextEpisode` to `PlayerControls`.
- On next-episode navigation: flush progress → `navigate(/player/episode/${nextEpisode.id})`.

**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Display `episodeLabel` (e.g., `S01E03 · Titre`) in the top bar when provided.
- Add "Épisode suivant" button (visible only when `nextEpisode` is defined).
- Near-end overlay: when `currentTime ≥ duration − NEAR_END_THRESHOLD_S` (constant = 90 s), show "Épisode suivant" card. Threshold defined as a named constant.
- Do NOT implement autoplay next episode (out of scope pending product decision).

### Step 10 — Skip intro / recap hooks
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Add prop: `markers?: Array<{type: 'intro'|'recap'|'outro', startSeconds: number, endSeconds: number}>`.
- When `currentTime` falls within a marker's range, show the appropriate button (`Passer l'intro`, `Passer le récap`, `Épisode suivant`). Click jumps to `marker.endSeconds`.
- When `markers` is empty or undefined, render nothing.

**File**: `apps/web/src/pages/PlayerPage.tsx`
- Pass `markers={[]}` for now; backend marker API is out of scope for this ticket.

### Step 11 — Playback speed
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Add a speed popover menu: 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2×.
- Set `video.playbackRate` on selection; listen to `ratechange` to confirm.
- Default 1×; disabled values shown visually disabled if rate does not apply after `ratechange`.

### Step 12 — Picture-in-Picture
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Show PiP button only when `document.pictureInPictureEnabled && !video.disablePictureInPicture`.
- Toggle via `video.requestPictureInPicture()` / `document.exitPictureInPicture()`.
- Sync state via `enterpictureinpicture` / `leavepictureinpicture` events.
- Progress tracking via `useProgressSync` continues unchanged (video element keeps firing `timeupdate` in PiP mode).

### Step 13 — Quality / source selector improvement
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Replace the existing `<select>` dropdown with a styled popover menu matching audio/subtitle menus.
- Label each variant as `{quality} · {audioLanguage}` (hide raw provider names and Xtream IDs).
- On switch: flush progress → call `onVariantSwitch(id)`; resume position is already restored via `startPositionSeconds`.

### Step 14 — Accessibility pass
**File**: `apps/web/src/components/player/PlayerControls.tsx`
- Add `role="menu"` and `aria-label` to each popover.
- Add `aria-pressed` to play/pause, mute, PiP, fullscreen toggle buttons.
- Add `role="menuitem"` to each track option.
- Ensure all interactive elements have visible `:focus-visible` outlines.

### Step 15 — Tests
- `apps/web/src/lib/format-time.test.ts` (extract `formatTime` to `apps/web/src/lib/format-time.ts`): 0, >1 h, Infinity, NaN.
- `apps/web/src/lib/language-names.test.ts`: ISO 639-1/2 code → display name mapping.
- `apps/web/src/hooks/useProgressSync.test.ts`: pause triggers immediate flush; debounce prevents duplicate sends; `flushProgress()` works.
- `apps/web/src/components/player/PlayerControls.test.tsx`:
  - Play/pause via button and keyboard (Space, K).
  - ±10 s skip, clamp at 0 and duration.
  - Controls auto-hide while playing; visible while paused.
  - Audio menu renders only when `audioTracks.length > 1`.
  - Subtitle menu always includes "Désactivés".
  - Markers render contextually.
  - Speed selector updates `playbackRate`.
  - PiP button absent when `document.pictureInPictureEnabled` is false.
- `apps/web/src/pages/PlayerPage.test.tsx`:
  - Resume dialog shown when `startPositionSeconds > 30`.
  - "Recommencer" resets to 0.
  - Regression: HLS.js `loadSource` called with correct gateway URL.

## Excluded
- Backend marker / intro-skip timestamp API (no marker data exists; shape is wired but stays empty).
- Autoplay next episode (pending product decision).
- Full subtitle appearance settings panel (text size, background — deferred to a follow-up ticket).
- Server-side audio remuxing or track extraction for DIRECT MKV streams (HLS.js in-stream switching is the only supported path; no backend ffmpeg changes for this ticket).
- Full accessibility settings system (subtitle appearance, font scaling, etc.).
- Transcode delivery mode audio switching (single-track output by design; language selection via variant choice only).
- PGS / image-based subtitle burn-in or transcode (explicitly unsupported; detected and communicated in UI).
- Autoplay previews / trailer integration.
- Any changes to the Xtream URL construction, Railway proxy, or ffmpeg pipeline.

## Acceptance criteria
- [ ] Playing a real Xtream movie via the working delivery path is not regressed; smoke test asserts `loadSource` is called.
- [ ] Play/pause button and video-center tap toggle playback; state is driven by real HTMLMediaElement events, not a React boolean.
- [ ] Timeline shows current position and total duration; click/drag seeks correctly; `seekable` is checked before enabling the input.
- [ ] ±10 s skip buttons work and clamp at 0 / duration.
- [ ] Buffering and seeking states show the spinner.
- [ ] Auto-hide fires after 3 s of inactivity while playing; controls remain visible while paused; hide timer pauses while seek/volume is being dragged.
- [ ] Desktop keyboard shortcuts (Space, K, ArrowLeft, ArrowRight, M, F, Escape) work with no interference from input focus.
- [ ] Volume slider and mute work on desktop; mobile layout does not show an inoperable volume slider.
- [ ] Fullscreen works via standard API on desktop/Android; iOS Safari falls back to `webkitEnterFullscreen`.
- [ ] Resume dialog appears for meaningful saved progress (> 30 s, not near end); "Recommencer" correctly resets position.
- [ ] Progress is saved on pause (immediate) and on `beforeunload` via `sendBeacon`.
- [ ] `flushProgress()` is called before variant and episode switches.
- [ ] Audio popover appears only when HLS.js reports more than one audio track; switching changes `hls.audioTrack`.
- [ ] Subtitle popover appears when tracks exist; "Désactivés" is always present and functional.
- [ ] WebVTT subtitles render with `::cue` styling (dark background, bottom placement, safe margin above controls).
- [ ] Embedded MKV subtitle detection surfaces "non disponibles" rather than silently failing.
- [ ] Audio and subtitle language preferences are persisted to profile on selection.
- [ ] Episode label (SxxExx · title) shows in top bar for episode playback.
- [ ] "Épisode suivant" button and near-end overlay work; navigation flushes progress first.
- [ ] Marker buttons render when `markers` prop is populated; nothing renders when it is empty.
- [ ] Playback speed popover sets `video.playbackRate`; unsupported values shown as disabled.
- [ ] PiP button visible only when `document.pictureInPictureEnabled`; toggle works.
- [ ] Quality/source popover replaces the `<select>` dropdown; no raw provider names or Xtream IDs shown.
- [ ] `aria-pressed`, `role="menu"`, `role="menuitem"`, `:focus-visible` present on all relevant controls.
- [ ] `formatTime`, `language-names`, `useProgressSync`, `PlayerControls`, and `PlayerPage` unit tests pass.
- [ ] Manual verification on a real desktop browser and a real mobile browser: start, pause, seek, fullscreen, close/reopen at saved position, episode navigation if a Series fixture is available.
- [ ] Audio/subtitle multi-track switching manually verified on a real multi-track source, or documented as `BLOCKED — NO REAL MULTI-TRACK FIXTURE` if no such fixture is available.
