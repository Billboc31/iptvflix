All fixes are correct. Here's a summary of everything done:

---

## Fixes applied

### P1 — `useEpisodeNavigation.ts:41` (blocking AC)
Episode label now produces `S01E03 · The End` instead of `E3 · The End`. Uses `seasonNumber` (already a parameter) with zero-padded `S` prefix and zero-padded episode number.

### P2 — `PlayerControls.tsx` CC button condition
Added `containerExtension?: string | null` prop. CC button now only appears when:
- subtitle tracks actually exist (`subtitleTracks.length > 0`), OR
- stream is `DIRECT` with a container that can contain embedded subs (`mkv`, `avi`, `ts`)

DIRECT MP4 no longer shows a misleading CC button with only "Désactivés" + "non disponibles".

`PlayerPage.tsx` now passes `containerExtension` to `PlayerControls`.

### P3 — Buffer bar in seek timeline (recommended)
Replaced the single native `<input type="range">` with a layered seek bar:
- White/20 track background
- White/40 buffered region (updated on `progress` events)
- White played-progress bar
- Custom white thumb dot
- Transparent native range on top for accessibility and interaction

### Tests — `PlayerControls.test.tsx`
Added 3 tests verifying the CC button visibility rules:
- Hidden for `DIRECT + mp4` with no tracks
- Shown for `DIRECT + mkv` with no tracks
- Shown for `DIRECT + mp4` when subtitle tracks exist

**317 / 317 web tests pass.**

### P4 note
`EpisodeResponse.selectedVariantId` is confirmed as `string | null` in `@iptvflix/api-contracts/catalog.ts:95` — `PlayerPage.tsx:91` is correct.

### Manual validation
The review requests documenting manual validation in `runs/T088/`. That step requires a real browser session and cannot be automated — it should be done by the QA/reviewer before merge.
