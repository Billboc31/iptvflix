All 314 tests pass. Here's a summary of everything implemented:

## Summary

### New files created
| File | Purpose |
|---|---|
| `apps/web/src/lib/format-time.ts` | `formatTime()` extracted as a shared utility |
| `apps/web/src/lib/language-names.ts` | `getLanguageName()` maps ISO 639-1/2 codes to display names |
| `apps/web/src/hooks/usePlayerKeyboard.ts` | Keyboard shortcuts: Space/K=play-pause, ←→=±10s, M=mute, F=fullscreen, Esc=exit-fullscreen |
| `apps/web/src/hooks/useEpisodeNavigation.ts` | Derives episode label, next/previous episode from the season list |
| `apps/web/src/lib/format-time.test.ts` | Tests for formatTime (0, >1h, Infinity, NaN) |
| `apps/web/src/lib/language-names.test.ts` | Tests for ISO language code mapping |
| `apps/web/src/hooks/useProgressSync.test.ts` | Tests: pause flush, debounce, flushProgress callback |
| `apps/web/src/components/player/PlayerControls.test.tsx` | Tests: play/pause, ±10s clamp, audio/subtitle menus, markers, speed, PiP detection, episode nav, keyboard |
| `apps/web/src/pages/PlayerPage.test.tsx` | Regression smoke test + resume dialog tests |

### Modified files
| File | Changes |
|---|---|
| `useProgressSync.ts` | Immediate flush on `pause` event; `fetch + keepalive` on `beforeunload`; exported `flushProgress()` callback |
| `PlayerControls.tsx` | Full overhaul: ±10s skip, seeking state, pointer events for mobile, safe-area padding, iOS Safari fullscreen, audio/subtitle/speed/quality popovers, PiP, markers, episode label + next-episode UX, `::cue` subtitle styling, full accessibility (`aria-pressed`, `role="menu"`, `role="menuitem"`, `:focus-visible`) |
| `PlayerPage.tsx` | Resume dialog (with `RESUME_THRESHOLD_START_S`/`RESUME_THRESHOLD_END_S` constants); HLS.js audio+subtitle track state wiring; `flushProgress()` called before variant/episode switches; episode navigation via `useEpisodeNavigation` |
| `EpisodeCard.tsx` | Adds `seriesId`/`seasonNumber` props; includes them in the player URL |
| `SeasonSelector.tsx` | Passes `seriesId`/`selectedSeason` down to each `EpisodeCard` |

### Architecture notes (documented constraints)
- **Audio track switching**: only works via `hls.audioTrack` when the HLS manifest has `#EXT-X-MEDIA` audio renditions. DIRECT MP4/MKV: no `HTMLMediaElement.audioTracks` in Chromium — variant-level switching only.
- **Embedded MKV subtitles (SRT/ASS/PGS)**: not browser-renderable; detected and surfaced as "Sous-titres non disponibles" in the CC menu.
- **`beforeunload` progress**: uses `fetch + keepalive` (supports Bearer auth) rather than `sendBeacon` (which cannot set custom headers and the API requires Bearer auth).
