# Test Report — T033: Add source-priority controls to playback preferences UI

## Acceptance Criteria

### AC1 — Profile settings list configured sources with human-readable names
**PASS**

`SourcePriorityInput` maps each id in `preferredSourceIds` through `sources.find(s => s.id === id)?.name`, displaying `source.name` in the `<li>` element. The "render source names" test confirms `Xtream HD` and `Plex Home` appear in the DOM when the profile returns `['src-a', 'src-b']`.

### AC2 — Sources can be reordered by priority
**PASS**

`moveUp` / `moveDown` buttons are rendered for each displayed source with correct `aria-label` attributes. The "moves a source down" test clicks "Descendre Xtream HD", then asserts `Plex Home` appears before `Xtream HD` in the list.

### AC3 — Saved ordering is persisted in `preferredSourceIds`
**PASS**

`handleSave` passes the current `prefs.preferredSourceIds` (filtered to known ids) to `updateProfilePreferences`. The "submitting the form sends preferredSourceIds in the reordered order" test reorders, submits, and asserts `capturedBody.preferredSourceIds === ['src-b', 'src-a']`.

### AC4 — The backend resolver uses that ordering without frontend-side ranking logic
**PASS**

`availability-resolver.ts:45` calls `prefs.preferredSourceIds.indexOf(variant.providerId)` directly on the array received from the API. No re-sorting or re-ranking occurs in the frontend. The frontend simply passes the user-ordered array to the PATCH endpoint; the resolver consumes it as-is. All 399 backend tests pass.

### AC5 — Missing/deleted source ids are handled safely
**PASS**

`displayedIds` is computed as `value.filter(id => sources.some(s => s.id === id))`, so stale ids are excluded from the rendered list. In `handleSave`, `preferredSourceIds` is filtered to `sources.some(s => s.id === id)` before the API call. The "does not render stale source ids" test sets `preferredSourceIds: ['deleted-id']`, confirms `deleted-id` is not in the DOM, and asserts the PATCH body contains `preferredSourceIds: []`.

### AC6 — Automated frontend/API tests cover loading, reordering and saving source priorities
**PASS**

Four new tests in `ProfileSettingsPage.test.tsx`:
- `renders source names from preferredSourceIds in priority order` (loading + display)
- `moves a source down and updates the display order` (reordering)
- `submitting the form sends preferredSourceIds in the reordered order` (save with ordering)
- `does not render stale source ids and excludes them from the save payload` (stale id safety)

All four pass. The existing three tests pass without regression.

## Test Run Results

| Suite | Files | Tests | Status |
|---|---|---|---|
| `apps/web` vitest | 15 | 81 | all pass |
| `apps/api` vitest | 28 | 399 | all pass |

**Total: 480/480 tests pass — 0 failures, 0 regressions.**

## Minor Observations (non-blocking)

1. `moveUp`/`moveDown` operate on `displayedIds` (stale ids already filtered), so stale ids are dropped from the internal ordering as soon as a reorder occurs — slightly more aggressive than spec, but consistent and not harmful.
2. The "add via dropdown" flow is not covered by an automated test. This was explicitly out of scope in the plan.

## Decision

**VALIDATED** — All six acceptance criteria are met. No blocking issues.
