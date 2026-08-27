I have all the information needed. Here is the test report.

---

## Test Report — T138: Android TV Universal Live Search

**Branch**: `ticket/T138-add-android-tv-universal-channel-program-search-wi`
**Date**: 2026-08-27

---

### Summary

| Result | Count |
|--------|-------|
| PASS   | 12    |
| FAIL   | 1     |
| Blocking issues | 1 |

---

### Acceptance Criteria

---

**AC1 — Android TV Live exposes universal Search accessible with D-pad**

**PASS**

`Screen.LiveTvSearch` is declared in `AppNavGraph.kt:26` and reachable from `LiveTvHomeScreen` via an `onOpenSearch` callback wired at `AppNavGraph.kt:121`. The `LiveSearchScreen` uses `TvLazyColumn` and TV Material3 `Surface` components — all D-pad navigable. Focus is auto-set to the search bar on entry via `LaunchedEffect(Unit)` (`LiveSearchScreen.kt:115-117`).

---

**AC2 — Search can find canonical channels by name**

**PASS**

Backend (`live-search-service.ts:39-46`) queries `channels.canonicalName` and `channels.normalizedName` with `unaccent(lower(...)) ILIKE`. Results flow to `ChannelSearchResult` and render in `ChannelSearchRow`. Test: `channel-name query returns Results with channels`.

---

**AC3 — Search can find EPG programs and separates current from upcoming**

**PASS**

`searchLiveTV` separates EPG matches into `liveNow` (currently airing, `isLive = true`) and `upcoming` (future, `isLive = false`). ViewModel maps these to `LiveSearchState.Results.liveNow` and `.upcoming`. UI renders them under distinct section headers "En direct maintenant" and "À venir". Tests cover both paths independently.

---

**AC4 — `En direct maintenant` results display channel + program info and can launch playback**

**PASS**

`LiveNowRow` (`LiveSearchScreen.kt:444-540`) displays: channel logo, channel name, program title, `HH:mm–HH:mm` time range, progress bar, and orange EN DIRECT badge. `Surface(onClick = onSelected)` triggers `onLiveNowSelected` → `commandVm.playLocal(PlaybackCommand(mediaType = "channel", mediaId = result.channelId))` → `Screen.Player` (`AppNavGraph.kt:138-150`).

---

**AC5 — `À venir` results display date + time prominently and do not launch playback**

**PASS**

`UpcomingRow` (`LiveSearchScreen.kt:543-620`) shows time at 20sp bold and date at 12sp. The `Surface(onClick = {})` at line 556 is a no-op — pressing OK on an upcoming result does nothing. No playback is triggered.

---

**AC6 — Multiple current broadcasters are presented as a selectable list**

**PASS**

`ResultsContent` renders `items(state.liveNow)` as a full list (`LiveSearchScreen.kt:388-399`). Each item is an independently focusable, clickable `Surface`. Test: `multiple live matches yields isSingleLiveNowResult false` validates that multiple results reach the Results state correctly.

---

**AC7 — Single high-confidence live result has minimal-friction launch without auto-launching fuzzy matches**

**PASS**

When `isSingleLiveNowResult` is true, the badge reads `"Lancer · EN DIRECT"` instead of `"EN DIRECT"` (`LiveSearchScreen.kt:459`). Auto-focus moves to the first (and only) live result via `firstLiveNowFr.requestFocus()` on result arrival (`ResultsContent:374-378`), so the user can launch with one OK press. The ticket explicitly allows "one OK press if that is safer with the existing Android TV interaction model." No auto-launch occurs — the user must confirm. `isSingleLiveNowResult` is a computed property on the sealed Results state (`LiveSearchViewModel.kt:37-38`), so fuzzy/multi-match scenarios correctly fall through to the plain "EN DIRECT" badge.

---

**AC8 — Voice input uses Android TV mechanisms where available, falls back cleanly to text**

**PASS**

`hasVoice` is resolved at composition time via `PackageManager.resolveActivity(ACTION_RECOGNIZE_SPEECH)` (`LiveSearchScreen.kt:93-99`). The mic button is only rendered when `hasVoice` is true (`LiveSearchScreen.kt:241`). Voice launches `RecognizerIntent.ACTION_RECOGNIZE_SPEECH` and on `RESULT_OK` sets the query text and calls `viewModel.onVoiceResult(text)` which delegates directly to `onQueryChanged()` (`LiveSearchViewModel.kt:74-76`). On devices without voice, the UI degrades cleanly to text-only.

---

**AC9 — Orange Live TV focus/active styling used throughout**

**PASS**

`TvColors.LiveTvAccent = Color(0xFFFF8C00)` (orange). Applied to: search bar underline and cursor on focus, search icon, mic button focused fill, all card focused borders (3dp orange), EN DIRECT badge background, progress bar fill, category badge text and background, loading spinner arc. Consistent throughout `LiveSearchScreen.kt`.

---

**AC10 — Raw duplicate ChannelSource entries never appear as separate results**

**PASS**

Backend builds `liveNowMap` keyed by `channel.id` (canonical channel, not source) — each canonical channel appears at most once in liveNow (`live-search-service.ts:96-122`). Channels already in liveNow are excluded from the channels section (`live-search-service.ts:151`). Source deduplication is handled in step 3 by taking only the highest-priority `AVAILABLE` source per channel (`live-search-service.ts:86-92`).

---

**AC11 — Playback uses canonical source selection/failover and integrates with existing Live player/zapping/overlay**

**PASS**

Sources are fetched ordered by `desc(channelSources.priority)` with `status = 'AVAILABLE'` (`live-search-service.ts:83-93`). The Android `PlaybackCommand` uses `mediaId = result.channelId` and `mediaType = "channel"` — not a raw stream URL — so the existing player resolves the stream through its normal canonical path (`AppNavGraph.kt:138-150`). Navigation goes to `Screen.Player` / `PlayerScreen`, the same player used by all other Live TV playback. Existing zapping and side-overlay behaviors are thus available by construction.

Note: `deliveryMode` in the API response is hardcoded to `"DIRECT"` with a comment acknowledging clients should call `/channels/:id/playback/resolve` for authoritative mode. The Android client does not call this endpoint, relying instead on the channel ID route. This is acceptable given the existing player architecture, but the API comment should not be left unresolved long-term.

---

**AC12 — Search remains useful for channels when EPG is unavailable**

**PASS**

The channel name query (`unaccent ILIKE`) runs independently of the EPG cache. When `epgCache` is null, `searchEpgPrograms` returns empty but channel rows are still fetched and returned. Test: `channel-name search without EPG still returns channels in Results` explicitly covers this case (`LiveSearchViewModelTest.kt:215-232`).

---

**AC13 — Android tests: channel search, live program search, upcoming-only, multiple live, unique-live fast launch, voice/text flow, focus restoration, no-EPG behavior**

**FAIL — focus restoration test is missing**

`LiveSearchViewModelTest.kt` contains 11 unit tests covering:
- Channel search ✅ (line 76)
- Live program search ✅ (line 91)
- Upcoming-only search ✅ (line 104)
- Multiple live matches ✅ (line 118)
- Unique-live fast launch (`isSingleLiveNowResult = true`) ✅ (line 131)
- Voice/text query equivalence ✅ (line 145)
- No-EPG channel search ✅ (line 215)

**Missing: focus restoration test.** The ticket explicitly requires a test for focus restoration (e.g. search bar re-focuses after returning from player, or first result gets focus on new query). The `FocusRequester` logic in `LiveSearchScreen.kt` handles this at the UI layer (`LaunchedEffect(Unit)`, `LaunchedEffect(state)`, `LaunchedEffect(state.query)`) but no test verifies it.

Additionally, all tests live in `src/test/` (JVM unit tests). `FocusRequester` behavior is a UI concern that cannot be exercised in JVM unit tests — it requires instrumentation tests (`src/androidTest/`). No `androidTest` directory exists in the Android TV module. This is a second gap: instrumentation-level test coverage for focus behavior, voice launcher integration, and end-to-end search → result → playback flows are absent.

---

### Blocking issues

**1. Missing focus restoration test (AC13)**

The acceptance criterion explicitly names focus restoration as a required test. It is not present. This must be added before validation can be considered complete. A minimal acceptable form would be a ViewModel-level test verifying that `LiveSearchState.Idle` is emitted on `clearQuery()` and that the state triggers a focus-request side-effect — or a Compose UI test using `createAndroidComposeRule` in `androidTest`.

---

### Non-blocking observations

- `deliveryMode: 'DIRECT'` is hardcoded in the backend with an inline comment. Consider tracking a follow-up to call `/channels/:id/playback/resolve` on the Android side before playback, or remove the field until it carries real data.
- `UpcomingRow` is focusable and shows an orange focus border but pressing OK is a silent no-op. A short "Ce programme n'est pas encore disponible" text or disabling the click affordance would improve UX, though it does not block the current criterion.
- No `androidTest` (instrumentation) directory exists. Future tickets adding E2E search or player integration tests will need this scaffold.

---

### Verdict

**REFUSED — AC13 not fully satisfied.** One OK press and minimal-friction flow are implemented correctly; all other criteria pass. The implementation is blocked by the missing focus restoration test.
