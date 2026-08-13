Here is the test report for T057:

---

## T057 Test Report — PASS

**Test suite**: 157/157 passing (`apps/web/` vitest run)  
**T057-specific tests**: 27 tests across 4 files — all pass

---

### Acceptance Criteria

| # | Criterion | Status |
|---|-----------|--------|
| AC1 | Web can approve/pair a TV using the code/token flow | ✅ PASS |
| AC2 | Paired TVs visible by friendly name, can be renamed/revoked | ✅ PASS |
| AC3 | Movie detail can send "Play on TV" to a selected paired TV | ✅ PASS |
| AC4 | Episode handed off with correct canonical episode identity | ✅ PASS |
| AC5 | Resume/from-start selection preserved in the command | ✅ PASS |
| AC6 | One paired device supports low-friction one-tap handoff | ✅ PASS |
| AC7 | Offline/revoked/expired targets produce clear UI state, do not silently succeed | ✅ PASS |
| AC8 | Web still supports local Web playback independently | ✅ PASS |
| AC9 | Frontend tests cover pairing approval, device selection, fast path, resume handoff, offline/error states | ✅ PASS |

---

### Key Verifications

- **Pairing flow** (`DeviceSettingsPage`): validates code status (pending/expired/approved), handles 404, shows specific errors for each case
- **Fast path**: single device → command sent immediately with no modal UI; `device-offline` correctly surfaces as toast error in `MovieDetailPage`
- **Resume toggle**: shown only when `progressMs > 0`; "Reprendre" correctly sets `startPositionMs` in request body (verified by intercepting the raw request in tests)
- **Offline device**: disabled in multi-picker (cannot be clicked); `usePlayOnTv.send()` short-circuits on `isDeviceOnline()` check before any API call
- **Local playback preserved**: `▶ Lecture` button always rendered; TV button is strictly additive

### Non-blocking Observations

1. `listDevices()` errors are swallowed silently — device list shows as empty with no user-facing error
2. No polling to refresh device online status while picker is open (within scope)
3. Running vitest from the monorepo root (not `apps/web/`) fails with missing DOM environment — pre-existing issue, unrelated to T057

**Full report saved to**: `runs/T057/tests/tester-report.md`
