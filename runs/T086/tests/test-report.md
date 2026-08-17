**Verdict: PASS**

Here is the full test report summary.

---

## T086 Test Report

All 267 web tests pass. The 5 API failures are pre-existing on `main` (sync pipeline + title-matching) and unrelated to this ticket.

### Acceptance Criteria — all 18 pass

| # | Criterion | Status |
|---|---|---|
| AC-1 | Détails scoped to hovered card only | **PASS** |
| AC-2 | All hover overlays/controls scoped per card | **PASS** |
| AC-3 | Sustained hover (400 ms) smoothly enlarges focused card | **PASS** |
| AC-4 | Enlarged card above neighboring content, no clipping | **PASS** |
| AC-5 | Edge cards expand inward gracefully | **PASS** |
| AC-6 | No permanent page reflow/jump | **PASS** |
| AC-7 | Preview plays only inside focused enlarged card | **PASS** |
| AC-8 | Only one preview active at any time | **PASS** |
| AC-9 | Preview starts muted | **PASS** |
| AC-10 | Leaving card stops and cleans up preview | **PASS** |
| AC-11 | Rapid hover changes cannot trigger stale previews | **PASS** |
| AC-12 | Preview failure/no-preview falls back to artwork silently | **PASS** |
| AC-13 | No fake Lecture action for non-VOD titles | **PASS** |
| AC-14 | Détails opens existing shared modal | **PASS** |
| AC-15 | VOD playback pipeline unchanged | **PASS** |
| AC-16 | Mobile/touch unaffected | **PASS** |
| AC-17 | Keyboard users can reach card actions | **PASS** (note below) |
| AC-18 | Tests cover hover isolation and preview cleanup | **PASS** |

### Key fixes verified

- **Root bug**: `HorizontalRow` had `class="relative group"` — renamed to `group/row` with scoped `group-hover/row:` selectors on arrow buttons. This eliminates the unnamed group ancestor that was leaking hover state to all child `PosterCard`s.
- **Portal approach**: `FocusedCardPortal` uses `createPortal(…, document.body)` with `position: fixed` — no layout reflow, no clipping, proper z-index (35).
- **Race guard**: `hoverEpoch` counter prevents stale timers from promoting cards that were hovered briefly.

### Non-blocking concerns

- **NC-1**: Portal uses `posterUrl` as backdrop instead of a dedicated TMDB backdrop image. Still shows a filled image — no blank rectangle.
- **NC-2**: No Play/Resume button in the focused portal (only Détails). Safe — avoids fake Lecture action.
- **AC-17 note**: Keyboard focus triggers the preview timer (produces muted media after ~1.9 s). No audio plays unexpectedly; "noisy media" condition is not violated. Stricter no-preview-on-keyboard-focus would require distinguishing mouse vs keyboard events in `handleEnter`.
