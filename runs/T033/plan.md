## Objective

Add a source-priority section to the profile playback settings page so users can build and reorder an ordered list of preferred source IDs that is persisted in `preferredSourceIds` and consumed by the existing backend resolver.

## Included

### `apps/web/src/pages/ProfileSettingsPage.tsx`

**New `SourcePriorityInput` component** (sibling of `LanguageListInput`):
- Props: `sources: SourceResponse[]`, `value: string[]`, `onChange: (v: string[]) => void`
- Renders the current ordered priority list by mapping each ID in `value` to its source name via `sources.find(s => s.id === id)?.name` — IDs not matched in the sources list are silently excluded from the displayed list (stale IDs are dropped on next save)
- Move-up / move-down buttons (▲ / ▼) using the same array-swap pattern as `LanguageListInput` (`moveUp` / `moveDown`)
- Remove button (✕) per entry
- Dropdown `<select>` listing sources not yet in `value` (by id), with an "Ajouter" button to append the selected source id to `value`
- Empty state label: `"Aucune source prioritaire configurée"`

**`ProfileSettingsPage` changes**:
- Add `import { listSources } from '../lib/api.js'` and `import type { SourceResponse } from '@iptvflix/api-contracts'`
- Add `const [sources, setSources] = useState<SourceResponse[]>([])` state
- In the existing `useEffect`, chain a `listSources()` call and call `setSources`; use `Promise.all` with `getProfile()` to keep a single loading state
- Insert `<SourcePriorityInput>` in the form between the subtitle-language input and the max-quality dropdown, wired to `prefs.preferredSourceIds`
- Before calling `updateProfilePreferences`, filter `prefs.preferredSourceIds` to only IDs present in `sources` so stale entries are dropped automatically on save

### `apps/web/src/pages/ProfileSettingsPage.test.tsx`

- Add `MOCK_SOURCES: SourceResponse[]` fixture with two sources (`{ id: 'src-a', name: 'Xtream HD', ... }`, `{ id: 'src-b', name: 'Plex Home', ... }`)
- Add `http.get('/api/sources', ...)` handler in each new test
- **New test — render source names**: verify that source names appear in the page when `preferredSourceIds` contains matching IDs
- **New test — reorder**: click ▼ on the first source row, assert the second source now appears first in the list
- **New test — save with ordering**: submit form, assert `capturedBody.preferredSourceIds` equals the ordered array
- **New test — stale id dropped**: set `preferredSourceIds: ['deleted-id']` in MOCK_PROFILE, verify `'deleted-id'` is not rendered and that submit sends `preferredSourceIds: []`

## Excluded

- Backend changes: `preferredSourceIds` is already stored in the profiles table, accepted by `PATCH /profile/preferences`, and used by the availability resolver — no API, schema, or resolver changes are needed
- Drag-and-drop reordering: the existing up/down arrow pattern matches the rest of the UI
- Filtering disabled vs enabled sources in the add-dropdown: the sources API already exposes `enabled`; include all sources returned by `listSources()` without additional filtering in this ticket
- Source management CRUD (add/delete sources): out of scope, handled by the sources settings page
- Backend tests: the resolver's `source_match` scoring is already covered in `availability-resolver.test.ts`

## Acceptance criteria

- The profile settings form loads both `GET /api/profile` and `GET /api/sources` before rendering the source section
- Sources in `preferredSourceIds` are displayed by their human-readable `name`, in priority order, with ▲/▼/✕ controls
- Clicking ▼ on row N swaps it with row N+1 and the new order is reflected immediately in the UI
- Submitting the form sends `preferredSourceIds` as the reordered array of IDs in the PATCH body
- An ID present in the saved preferences but absent from the sources list is neither displayed nor included in the next save payload
- All four new tests in `ProfileSettingsPage.test.tsx` pass (`vitest run`)
- No regression in the three existing tests in `ProfileSettingsPage.test.tsx`
