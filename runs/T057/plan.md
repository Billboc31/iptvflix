# T057 — Plan: Web 'Play on TV' device picker and remote handoff UX

## Objective

Add a "Play on TV" handoff action to the Web app's Movie/Episode detail pages that lets a user send playback to a paired Android TV through the existing backend command API, plus a device management settings page where the user can approve pairing codes, rename, and revoke paired TVs.

## Included

The backend (routes, services, schema, Android TV) is complete. All changes are in the Web frontend and shared-contracts layer.

### 1. API client — `/apps/web/src/lib/api.ts`

Add six functions using the existing authenticated `apiFetch` helper:

| Function | Method + Path |
|---|---|
| `listDevices()` | `GET /devices` → `DeviceResponse[]` |
| `getPairingCodeDetail(code)` | `GET /pairing/codes/:code` → `PairingCodeDetailResponse` |
| `approvePairingCode(code, name?)` | `POST /pairing/codes/:code/approve` → `DeviceResponse` |
| `sendPlayOnTvCommand(deviceId, payload)` | `POST /devices/:id/commands` → `PlaybackCommandResponse` |
| `renameDevice(deviceId, name)` | `PATCH /devices/:id` → `DeviceResponse` |
| `revokeDevice(deviceId)` | `DELETE /devices/:id` |

All use the web-secret `Authorization` header already in place for other calls.

### 2. Hook — `/apps/web/src/hooks/useDevices.ts`

- Fetches device list on mount; re-fetches after approve/rename/revoke mutations.
- Returns `{ devices, isLoading, approve(code, name?), rename(id, name), revoke(id), refetch }`.
- Classifies a device as "online" if `lastSeenAt` is within 90 seconds.
- Filters out revoked devices (those with `revokedAt` set).

### 3. Hook — `/apps/web/src/hooks/usePlayOnTv.ts`

- Accepts `mediaType`, `mediaId`, `availabilityId?`, `startPositionMs?`.
- Calls `sendPlayOnTvCommand` and exposes `commandState: 'idle' | 'sending' | 'delivered' | 'failed' | 'device-offline'`.
- Sets `device-offline` when selected device has no recent `lastSeenAt` before sending.
- Sets `failed` on non-2xx response or `CommandDeviceRevokedError` from API.
- No polling after send — state is determined by the HTTP response and device online classification.

### 4. Component — `/apps/web/src/components/devices/DevicePickerModal.tsx`

- Modal (overlay) opened when "Play on TV" is clicked and `devices.length > 1`.
- **Fast path**: if exactly one active device exists, skip the modal and send immediately, but still show the device name as confirmation toast.
- Per device: name, online/offline indicator (green dot / grey), disabled state for offline devices.
- Resume/from-start toggle shown when `progress.positionMs > 0` — sets `startPositionMs` accordingly.
- After selection: inline loading state on the selected item → success / error message inside the modal.
- On success: auto-close after 1.5 s.

### 5. Component — `/apps/web/src/components/devices/DeviceListItem.tsx`

Stateless presentational row: device name, online badge, rename button (inline edit), revoke button with confirmation popover.

### 6. "Play on TV" button — `MovieDetailPage.tsx` and `SeriesDetailPage.tsx`

- Render a secondary `"Play on TV"` button adjacent to the existing `"Play"` button **only when `devices.length > 0`**.
- Clicking opens `DevicePickerModal` (or triggers fast path).
- Normal "Play" / "Resume" local-web button is unchanged.

### 7. Settings page — `/apps/web/src/pages/DeviceSettingsPage.tsx`

Reachable at `/settings/devices`.

Two sections:

**Paired TVs** — renders a list of `DeviceListItem` components; handles empty state with a prompt to pair.

**Pair a new TV** — a small form:
  - Text input for the 8-character code shown on the TV pairing screen.
  - Optional "Device name" field.
  - On submit: calls `getPairingCodeDetail(code)` to validate (shows error if expired/unknown), then calls `approvePairingCode(code, name)`.
  - Success: adds the new device to the list; shows its name.
  - Error states: invalid code, already approved, expired.

### 8. Router — `/apps/web/src/App.tsx` (or router config)

Add route `path="/settings/devices"` → `DeviceSettingsPage`.
Add "Devices" link in the Settings navigation section of `ProfileSettingsPage.tsx`.

### 9. Tests

- `/apps/web/src/components/devices/DevicePickerModal.test.tsx`
  - Renders device list; fast-path skips modal for single device; offline device is disabled; resume toggle passes correct `startPositionMs`; success closes modal; API error shows error state.
- `/apps/web/src/pages/DeviceSettingsPage.test.tsx`
  - Pairing approval: valid code → device appears; expired code → error; rename; revoke with confirmation.
- `/apps/web/src/hooks/useDevices.test.ts` — unit tests for online classification and mutation callbacks.

## Excluded

- Any seek/volume/pause remote-control after playback starts on the TV.
- Chromecast / Google Cast SDK.
- Polling the command state after dispatch (backend SSE handles that on the TV side).
- Changes to Android TV, backend routes, services, or database schema.
- Progress sync or watch-history writes from the Web handoff flow.
- QR code display or generation in the Web UI.

## Acceptance criteria

1. A Movie detail page with at least one active paired device shows a "Play on TV" button beside "Play"; no devices → button absent.
2. Clicking "Play on TV" with a single active device sends the command immediately and displays a toast naming the target device.
3. Clicking "Play on TV" with multiple devices opens the picker modal; offline devices are visually distinct and non-selectable.
4. An Episode handoff sends the correct `mediaType: 'episode'` and `mediaId`.
5. When watch progress exists, the modal exposes a "Resume / From beginning" toggle and the selected value maps to `startPositionMs`.
6. An offline device (no recent `lastSeenAt`) produces a clear "device offline" error and does not call the command endpoint.
7. A revoked/unknown device response from the API produces a visible error in the modal; the modal does not auto-close.
8. Navigating to `/settings/devices` lists paired TVs with rename and revoke actions; revoked devices disappear from the list.
9. Submitting a valid 8-char code on the pairing form approves the pairing and the new device appears in the list immediately.
10. Submitting an expired or unknown code shows a specific error message.
11. The local "Play" / "Resume" web playback button continues to work independently.
12. All tests listed under §9 pass (`vitest run` or equivalent).
