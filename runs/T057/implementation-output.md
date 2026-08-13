All 23 test files, 154 tests pass. Here's the implementation summary:

---

## Changes summary

**Files created:**
- `apps/web/src/hooks/useDevices.ts` — device list hook with `isDeviceOnline` utility (90s threshold), filtering revoked devices, `approve`/`rename`/`revoke` mutations
- `apps/web/src/hooks/usePlayOnTv.ts` — command dispatch hook returning `CommandState`, checks offline before calling API
- `apps/web/src/components/devices/DeviceListItem.tsx` — stateless device row with inline rename (keyboard-friendly) and revoke-with-confirmation
- `apps/web/src/components/devices/DevicePickerModal.tsx` — modal with fast-path (single device auto-sends, calls `onFastPath` callback), multi-device picker, resume/from-start toggle, inline status feedback, 1.5s auto-close on success
- `apps/web/src/pages/DeviceSettingsPage.tsx` — `/settings/devices` page with paired-device list and pairing form (validates code detail before approving, shows specific errors for expired/unknown)
- `apps/web/src/hooks/useDevices.test.ts` — unit tests for online classification and mutation callbacks
- `apps/web/src/components/devices/DevicePickerModal.test.tsx` — fast path, offline device disabled, resume toggle, success/error states
- `apps/web/src/pages/DeviceSettingsPage.test.tsx` — pairing approval, expired/unknown code errors, rename, revoke with confirmation

**Files modified:**
- `apps/web/src/lib/api.ts` — 6 new functions: `listDevices`, `getPairingCodeDetail`, `approvePairingCode`, `sendPlayOnTvCommand`, `renameDevice`, `revokeDevice`
- `apps/web/src/pages/MovieDetailPage.tsx` — "📺 Lire sur TV" button (hidden when no devices), `DevicePickerModal` with toast callbacks
- `apps/web/src/components/detail/EpisodeRow.tsx` — "📺 TV" button + `DevicePickerModal` per episode, `devices` prop (default `[]`)
- `apps/web/src/components/detail/SeasonAccordion.tsx` — threads `devices` prop to `EpisodeRow`
- `apps/web/src/pages/SeriesDetailPage.tsx` — `useDevices` + passes devices to `SeasonAccordion`
- `apps/web/src/App.tsx` — route `/settings/devices`
- `apps/web/src/components/layout/LeftNav.tsx` — "Appareils TV" nav link
- `apps/web/src/test/handlers.ts` — `MOCK_DEVICE_ONLINE`, `MOCK_DEVICE_OFFLINE`, `MOCK_PAIRING_CODE_DETAIL`, `MOCK_PLAY_COMMAND` + MSW handlers for all device endpoints
- `apps/web/src/components/detail/EpisodeRow.test.tsx` — fixed pre-existing missing `MemoryRouter`/`ToastProvider` wrappers
