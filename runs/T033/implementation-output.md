All tests pass. Here's a summary of what was implemented:

---

## Summary

**Files modified:**

### `apps/web/src/pages/ProfileSettingsPage.tsx`
- Added `SourceResponse` to imports from `@iptvflix/api-contracts` and `listSources` from `../lib/api.js`
- Added `SourcePriorityInput` component (new, 105 lines) with:
  - Ordered display list showing source names resolved from IDs; stale IDs silently excluded
  - ▲/▼ move buttons using the same array-swap pattern as `LanguageListInput`
  - ✕ remove button per entry
  - Dropdown `<select>` + "Ajouter" button listing sources not already in the list
  - Empty state: "Aucune source prioritaire configurée"
- Added `sources` state and switched `useEffect` to `Promise.all([getProfile(), listSources()])`
- Inserted `<SourcePriorityInput>` between subtitle-language input and max-quality dropdown
- `handleSave` now filters `preferredSourceIds` to only known source IDs before sending to the API

### `apps/web/src/pages/ProfileSettingsPage.test.tsx`
- Added `SourceResponse` to type imports
- Added `MOCK_SOURCES` fixture (Xtream HD + Plex Home)
- Added 4 new tests: render source names, reorder via ▼, save ordering, stale ID dropped

**Result:** 81/81 tests pass, 0 regressions.
