# Test Report — T057: Add Web 'Play on TV' Device Picker and Remote Handoff UX

**Date**: 2026-08-13  
**Tester**: Tester Agent  
**Branch**: ticket/T057-add-web-play-on-tv-device-picker-and-remote-handof

---

## Test Suite Result

```
Tests: 157 passed (157)
Test Files: 23 passed (23)
```

All tests pass when run from `apps/web/` using the project vitest config.

> Note: Running `npx vitest run` from the workspace root picks up a different config and produces widespread `document is not defined` errors (DOM environment not initialised). This is a pre-existing workspace configuration issue, not caused by T057. The `apps/web/vitest.config.ts` correctly sets `environment: 'jsdom'`.

---

## T057-Specific Tests

| File | Tests | Result |
|------|-------|--------|
| `src/components/devices/DevicePickerModal.test.tsx` | 8 | ✅ All pass |
| `src/hooks/useDevices.test.ts` | 8 | ✅ All pass |
| `src/pages/DeviceSettingsPage.test.tsx` | 8 | ✅ All pass |
| `src/components/detail/EpisodeRow.test.tsx` (new cases) | 3 | ✅ All pass |

**T057-specific total**: 27 tests, 27 passing.

---

## Acceptance Criteria Verification

### AC1 — Web can approve/pair a TV using the code/token flow from #104.
**Status**: ✅ PASS

`DeviceSettingsPage` (`src/pages/DeviceSettingsPage.tsx`) implements a pairing form:
- Calls `getPairingCodeDetail(code)` to validate status (pending / expired / approved)
- On valid pending code: calls `approve(code, name?)` → `POST /pairing/codes/:code/approve`
- Shows specific errors: expired code, already-approved code, unknown/404 code
- On success: shows device name in success message, clears form, and adds device to list

**Test coverage**: `DeviceSettingsPage.test.tsx` — tests for valid pairing, expired code error, and unknown code error.

---

### AC2 — Paired TVs are visible by friendly name and can be renamed/revoked.
**Status**: ✅ PASS

`DeviceSettingsPage` renders each paired device via `DeviceListItem`:
- Shows human-readable device name
- Shows online/offline badge (90-second threshold via `isDeviceOnline()`)
- Inline rename with text input + OK button (`PATCH /devices/:id`)
- Revoke with confirmation popover (`DELETE /devices/:id`), device removed from list on confirmation

**Test coverage**: `DeviceSettingsPage.test.tsx` — shows devices list, shows online/offline status, rename updates name, revoke requires confirmation and removes device.

---

### AC3 — A Movie detail can send "Play on TV" to a selected paired TV.
**Status**: ✅ PASS

`MovieDetailPage` (`src/pages/MovieDetailPage.tsx:248-252`):
- Calls `useDevices()` on mount
- Renders `📺 Lire sur TV` button only when `devices.length > 0`
- Opens `DevicePickerModal` with `mediaType="movie"`, `mediaId`, `availabilityId`, `progressMs`
- Modal sends `POST /devices/:id/commands` with correct payload

---

### AC4 — An Episode can be handed off with the correct canonical episode identity.
**Status**: ✅ PASS

`EpisodeRow` (`src/components/detail/EpisodeRow.tsx:84-91`):
- Renders a `📺 TV` button for available episodes when `devices.length > 0`
- Passes `mediaType="episode"` and `mediaId={episode.id}` to `DevicePickerModal`
- Passes `availabilityId={episode.selectedVariantId}` for canonical variant selection
- `SeriesDetailPage` threads both `devices` and `progressByEpisodeId` down through `SeasonAccordion` → `EpisodeRow`

**Test coverage**: `EpisodeRow.test.tsx` — TV button shown with devices, not shown without devices, not shown for UNAVAILABLE episodes.

---

### AC5 — Resume/from-start selection is preserved in the command.
**Status**: ✅ PASS

`DevicePickerModal` (`src/components/devices/DevicePickerModal.tsx:118-139`):
- Resume toggle is shown only when `progressMs > 0`
- "Depuis le début" → `startPositionMs` omitted from payload (default `resume = false`)
- "Reprendre" → `startPositionMs: progressMs` included in payload
- `buildPayload()` at line 67-74 applies this logic correctly

**Test coverage**: `DevicePickerModal.test.tsx` — `shows resume toggle when progressMs > 0 and sends correct startPositionMs` verifies that selecting "Reprendre" and sending includes `startPositionMs: 60000` in the request body.

---

### AC6 — One paired device supports a low-friction one-tap handoff path.
**Status**: ✅ PASS

`DevicePickerModal` fast path (`src/components/devices/DevicePickerModal.tsx:35-49`):
- When `open=true` and `devices.length === 1`: sends command immediately via `useEffect`, no modal UI shown (`return null` at line 61)
- Calls `onFastPath(device.name, state)` callback for caller to surface feedback
- `MovieDetailPage` uses `onFastPath` to show a toast:
  - `delivered` → success toast with device name
  - `device-offline` → error toast with device name
  - other error → generic error toast

**Test coverage**: `DevicePickerModal.test.tsx` — `fast-path skips modal for single device and calls onFastPath` (online device → delivered), `fast-path reports device-offline when single device is offline`.

---

### AC7 — Offline/revoked/expired targets produce a clear UI state and do not silently succeed.
**Status**: ✅ PASS

Three distinct failure paths, all handled:

| Scenario | Handling |
|----------|----------|
| Offline device in multi-device picker | Button disabled (`disabled={!online}`); cannot be selected or submitted |
| Offline device in fast path | `usePlayOnTv.send()` checks `isDeviceOnline()` before API call; sets `device-offline` state; fast-path callback surfaces error toast |
| API error (network / 5xx) | `usePlayOnTv.send()` catches exception → `failed` state; modal shows "Erreur lors de l'envoi de la commande"; modal does not auto-close |
| Expired pairing code | `DeviceSettingsPage` checks `detail.status === 'expired'` before approving; shows "Ce code a expiré." error |
| Unknown/invalid pairing code | `ApiError` with status 404 caught; shows "Code inconnu ou expiré." |

**Test coverage**: `DevicePickerModal.test.tsx` — error message + no auto-close on API failure; `DeviceSettingsPage.test.tsx` — expired and unknown code error messages.

---

### AC8 — Web still supports local Web playback independently.
**Status**: ✅ PASS

`MovieDetailPage` (`src/pages/MovieDetailPage.tsx:235-246`): the `▶ Lecture` button navigating to `/player/movie/:id` is always rendered when an availability is selected, regardless of whether devices exist. The `📺 Lire sur TV` button is an additive action alongside it.

`EpisodeRow`: the existing play link to `/player/episode/:id` is always rendered for available episodes. The TV button is added conditionally.

---

### AC9 — Frontend tests cover pairing approval, device selection, one-device fast path, resume handoff and offline/error states.
**Status**: ✅ PASS

Coverage mapping:

| Scenario | Test |
|----------|------|
| Pairing approval (valid) | `DeviceSettingsPage > pairing approval: valid code shows new device` |
| Pairing approval (expired) | `DeviceSettingsPage > pairing approval: expired code shows specific error` |
| Pairing approval (unknown) | `DeviceSettingsPage > pairing approval: unknown code shows error` |
| Device selection in multi-picker | `DevicePickerModal > shows success message and auto-closes after delivery` |
| One-device fast path (online) | `DevicePickerModal > fast-path skips modal for single device and calls onFastPath` |
| One-device fast path (offline) | `DevicePickerModal > fast-path reports device-offline when single device is offline` |
| Resume handoff | `DevicePickerModal > shows resume toggle when progressMs > 0 and sends correct startPositionMs` |
| Offline device in picker | `DevicePickerModal > disables offline devices so they cannot be selected` |
| API error state | `DevicePickerModal > shows error message and does not auto-close on API failure` |
| Online/offline badge | `useDevices > isDeviceOnline returns true/false`, `DeviceSettingsPage > shows online/offline status` |

---

## Regressions

None. All 157 tests pass including existing tests for MovieDetailPage, SeriesDetailPage, SearchPage, ProfileSettingsPage, etc.

`ProfileSettingsPage.test.tsx` was updated to wrap renders in `MemoryRouter` (required by the new `Link` to `/settings/devices`) — this is a correct fix, not a regression.

---

## Blocking Issues

None.

---

## Non-blocking Observations

1. **`useDevices` error swallowed silently**: `listDevices()` failures are caught with `.catch(() => {})` — devices show as empty without any user-visible error. Acceptable for initial scope but worth noting for future hardening.

2. **No polling / device status refresh**: Online status is computed at render time from `lastSeenAt`. There is no background polling to refresh device status while the picker is open. A device that goes offline after the picker is opened will still appear as online until the modal is closed and reopened. This is within the accepted scope.

3. **Workspace-level vitest config gap**: `npx vitest run` from the monorepo root fails for all browser-rendering tests due to missing jsdom environment. This is unrelated to T057 but could confuse future CI if tests are run from root.

---

## Verdict

**PASS** — All 9 acceptance criteria are satisfied. Test suite is green (157/157). No regressions detected. No blocking issues found.
