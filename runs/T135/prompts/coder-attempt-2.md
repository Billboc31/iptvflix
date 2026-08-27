# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T135 — Build Android TV live channel selector overlay with EPG and persistent zapping

**Source**: GitHub Issue #287

## Description

## Context

Once a Live TV channel is playing on Android TV, channel discovery/switching must be possible without leaving playback.

The desired interaction is remote-first:

> While watching a channel, pressing **LEFT** opens a side overlay containing the channel list. Each row shows the channel identity and current program. Selecting another channel switches playback immediately, but the overlay **stays open** so the user can continue zapping/browsing. The user explicitly closes the overlay with BACK/RIGHT/another deliberate action.

This should feel like a modern set-top-box channel browser rather than navigating back to a separate channel page after every switch.

## Goal

Implement a persistent channel selector overlay inside the Android TV Live player.

## Overlay behavior

### Open

- When normal Live playback has focus and no conflicting modal/control owns the key, **DPAD_LEFT** opens a side layer/overlay.
- Playback continues behind the overlay.
- The overlay should occupy only part of the screen, leaving the current channel visibly playing.
- Use the Live TV dark + **orange** visual language.

### Channel list

Each channel row/card should support:

- canonical channel logo;
- canonical channel name;
- current EPG program title when available;
- current program start/end time and/or progress where available;
- favorite state when the existing canonical favorite model supports it;
- clear orange focused state;
- clear indicator for the channel currently being played.

EPG absence must degrade cleanly without fake data.

### Selection / persistent browsing

Critical interaction requirement:

- User moves focus through channels with DPAD_UP / DPAD_DOWN while the overlay is open.
- Pressing OK/ENTER on a channel starts/switches to that channel.
- **The overlay remains open after the channel switch.**
- Focus remains on the newly selected channel (or equivalent deterministic position), allowing the user to immediately select another channel.
- Playback behind the overlay updates to the newly selected stream.
- Do not navigate away/recreate the whole player screen solely to switch channel if the current player architecture supports an in-place media switch.

### Close

- BACK closes the channel overlay first and returns focus to full-screen playback.
- RIGHT may close the side overlay when appropriate, matching a natural left-panel interaction.
- Overlay should not trap focus or make playback controls unreachable.

## Ordering / filtering

Use canonical channel ordering/categories from the backend where available. At minimum the overlay should be able to browse all playable canonical channels.

Prefer preserving the user's current list context/category when feasible.

Do not expose `ChannelSource` duplicates in the overlay.

## Performance

Channel changes should feel fast:

- do not refetch the complete channel catalog on every selection;
- preload/cache lightweight channel + now-playing metadata where appropriate;
- use the canonical source-selection/failover backend flow;
- show a subtle loading state during stream switch without closing the overlay.

## Focus / remote details

- Opening overlay should initially focus the currently playing channel if present in the list.
- Focus position should survive a channel switch while the overlay stays open.
- Long lists should scroll to keep focused row visible.
- D-pad repeat should be handled sanely and not trigger accidental multiple OK selections.

## Acceptance criteria

- [ ] DPAD_LEFT during Live playback opens a side channel overlay.
- [ ] Overlay displays canonical channel logo/name and current EPG program where available.
- [ ] DPAD_UP/DOWN navigates channel rows with visible orange focus.
- [ ] OK changes to the selected channel without closing the overlay.
- [ ] After switching, overlay stays open and focus remains in a deterministic useful position.
- [ ] Current channel is visually identified.
- [ ] BACK closes overlay before exiting playback.
- [ ] EPG/no-EPG cases both render correctly.
- [ ] Raw duplicate sources never appear as separate rows.
- [ ] Channel switch uses existing source-selection/failover path and handles loading/failure gracefully.
- [ ] Add tests for overlay open/close, focus restoration, persistent overlay after selection, EPG rendering, and repeated channel switching.
- [ ] Existing VOD player controls are not regressed.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 8 files are in place. Here's a summary of the implementation:

---

## Summary

### New files

**`livetv/LiveChannelSelectorViewModel.kt`** — ViewModel scoped to `PlayerScreen`. Calls `repo.allChannels()` once on init; exposes `LiveChannelSelectorState` (Loading / Ready / Error). Factory uses `app.channelRepository`.

**`livetv/LiveChannelSelectorOverlay.kt`** — Left-side panel (320 dp wide, full height). Handles Loading/Error/Ready states internally. `ChannelSelectorRow` shows: logo or initial fallback, channel name, EPG title + `HH:mm–HH:mm` time range when available, now-playing indicator (▶), favorite badge. Focused row is orange; the currently playing row has an orange border. Per-row spinner replaces logo while that channel's stream is loading. `LaunchedEffect` scrolls to and focuses the current channel on open and after each switch.

**`livetv/LiveChannelSelectorViewModelTest.kt`** — 4 tests: Ready on success, Ready with empty list, Error on repository throw, EPG-present/absent coexistence.

**`player/LiveChannelSwitchTest.kt`** — 7 tests covering `buildChannelSwitchCommand`: `mediaType`, `mediaId`, `title`/`posterUrl` propagation, `startPositionMs = 0`, null fields, unique IDs per call, `ch-` prefix.

### Modified files

**`player/PlayerViewModel.kt`** — `switchChannel(channelId, title, logoUrl)` calls `load(buildChannelSwitchCommand(...))`. Internal `buildChannelSwitchCommand` builds a `PlaybackCommand(mediaType="channel", id="ch-{UUID}", …)` — testable independently.

**`player/PlayerScreen.kt`** — Obtains `LiveChannelSelectorViewModel` via factory. Tracks `isChannelSelectorOpen`, `loadingChannelId`, `currentChannelId` as local state. Key hierarchy extended: BACK closes overlay first; DPAD_RIGHT closes overlay; DPAD_LEFT opens overlay when playing a channel with chrome hidden. Auto-hide timer suppressed while overlay is open. Overlay mounted in `chromeContent` independently of chrome visibility.

**`livetv/LiveTvHomeScreen.kt`** — `onChannelSelected: (ChannelResponse) -> Unit` added (default no-op). Wired to `ChannelCard.onClick` and `ChannelListRow.onClick`, replacing the deferred stubs.

**`AppNavGraph.kt`** — `onChannelSelected` lambda on `LiveTvHomeScreen` builds a `PlaybackCommand(mediaType="channel")`, calls `commandVm.playLocal()`, then navigates to `Screen.Player`.

---

## Review

I have all the information needed. Here is the structured review.

---

# PR Review — T135: Android TV Live Channel Selector Overlay

## Summary

The implementation covers the full scope of the ticket: a persistent left-side channel selector overlay, in-place channel switching, correct focus management, EPG display, BACK/RIGHT close hierarchy, and ViewModel + unit tests. The VOD player controls are untouched. No regressions were introduced.

---

## Acceptance Criteria Coverage

| Criterion | Status | Notes |
|---|---|---|
| DPAD_LEFT opens overlay during Live playback | ✅ | Fires only when `mediaType == "channel"` and chrome is hidden (correct: no conflict with VOD seek) |
| Overlay shows logo/name/EPG | ✅ | Initials fallback, graceful EPG-absent rendering |
| DPAD_UP/DOWN with orange focus | ✅ | `TvLazyColumn` + `TvColors.LiveTvAccent` focus background |
| OK switches channel, overlay stays open | ✅ | `onChannelSelected` does not set `isChannelSelectorOpen = false` |
| Focus remains deterministic after switch | ✅ | `currentChannelId` updated immediately; `requestInitialFocus` propagated via index match |
| Current channel visually identified | ✅ | Orange tinted background + `▶` glyph on `isCurrentlyPlaying` row |
| BACK closes overlay first | ✅ | Back hierarchy at PlayerScreen lines 251–273 checks overlay before panel/chrome/exit |
| RIGHT closes overlay | ✅ | Lines 280–284 |
| EPG/no-EPG both render | ✅ | `if (channel.epg?.now != null)` guard, no placeholder crash |
| No ChannelSource duplicates | ✅ | Backend-delegated, per plan; no client-side dedup required |
| Channel switch uses failover path | ✅ | `switchChannel → load → PlaybackResolver` — identical path to all other playback |
| Loading state during switch | ✅ | `loadingChannelId` shows per-row spinner; cleared on `Playing` or `Error` |
| Tests | ✅ / partial | See below |
| VOD controls not regressed | ✅ | DPAD_LEFT only opens overlay for `mediaType == "channel"`; VOD seek path unchanged |

---

## Issues

### Medium — `LiveChannelSelectorState.Error` is unreachable in production

**File:** `livetv/ChannelRepository.kt` + `livetv/LiveChannelSelectorViewModel.kt`

`ChannelRepository.allChannels()` wraps `api.getChannels()` in `runCatching` and returns `emptyList()` on failure — it never throws. The `runCatching` in `LiveChannelSelectorViewModel.load()` therefore always sees a success result. The `Error` state can never be set at runtime.

Consequence: when the channel list fails to load (e.g., network outage), the overlay shows the "Chaînes" header with an empty `TvLazyColumn` and no explanatory message. The ticket requires failure to be handled gracefully; an unexplained empty panel is not graceful.

The `LiveChannelSelectorViewModelTest` test `Repository failure surfaces as Error` mocks the repository to throw directly, which bypasses this swallowing — so the test passes but validates a code path that production code cannot reach.

**Fix options (pick one):**
```kotlin
// Option A: propagate from ChannelRepository
suspend fun allChannels(): List<ChannelResponse> = api.getChannels()
// LiveChannelSelectorViewModel's runCatching then works as designed.

// Option B: targeted helper that propagates, leaving existing callers unchanged
suspend fun allChannelsOrThrow(): List<ChannelResponse> = api.getChannels()
// LiveChannelSelectorViewModel calls allChannelsOrThrow() instead.
```

Note: the same pattern exists in `LiveTvHomeViewModel` from T134, but `LiveTvHomeViewModel` shows an error screen — so fixing it there too would be worthwhile.

---

### Minor — Empty Ready state has no empty-list message in overlay

**File:** `livetv/LiveChannelSelectorOverlay.kt` (line 109–124)

When `state is LiveChannelSelectorState.Ready` but `channels.isEmpty()`, the `TvLazyColumn` renders with no items and no message. Depending on how Issue 1 is resolved (if error propagates, this can only happen when the backend returns zero channels), adding a fallback message is a small robustness improvement:

```kotlin
if (state.channels.isEmpty()) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("Aucune chaîne disponible", color = TvColors.TextMuted, fontSize = 13.sp)
    }
} else {
    TvLazyColumn(…) { … }
}
```

---

### Minor — No OK-press guard in channel selector (d-pad repeat)

The ticket explicitly requires "D-pad repeat should be handled sanely and not trigger accidental multiple OK selections."

`ChannelSelectorRow.Surface` uses the TV library's click dispatch. Holding ENTER could fire `onChannelSelected` multiple times in quick succession. Each call produces a new UUID command (bypassing `loadedCommandId` dedup in `PlayerViewModel.load`), triggering redundant loads. No crash, but unnecessary thrashing.

A simple guard in the `onChannelSelected` callback:
```kotlin
onChannelSelected = { ch ->
    if (loadingChannelId == null) {   // guard: ignore if a switch is already in-flight
        loadingChannelId = ch.id
        currentChannelId = ch.id
        vm.switchChannel(ch.id, ch.name, ch.logoUrl)
    }
},
```

---

### Observation — `ModeSwitchTest` tests trivial lambdas, not real components

`ModeSwitchTest` assigns string constants via lambdas and asserts on those strings. This validates no actual Kotlin/Compose/navigation logic. It passes by construction and would not catch any real regression. It is harmless but provides no coverage value.

---

## Architecture & Scope

- Scope: bounded correctly to the player + LiveTv home wiring. No changes outside the declared plan perimeter.
- `PlayerOverlayStack` (pre-T134): channel selector is correctly mounted in `chromeContent` (layer 4), above video, status, and action overlays.
- The `LiveChannelSelectorViewModel` is scoped to `PlayerScreen` via `viewModel()`, and the channel list is fetched once per player session (not per switch). Cache invalidation is tied to screen lifecycle — correct.
- `formatEpgTime` handles both ISO 8601 (`"2026-08-27T18:00:00Z"` → `"18:00"`) and plain time strings gracefully.
- `LaunchedEffect(requestInitialFocus)` pattern for focus is consistent with the existing `EpisodeRow` / `ChannelCard` / `CheckOption` pattern throughout the codebase.
- `isChannelSelectorOpen` is included in the auto-hide `LaunchedEffect` keys, correctly preventing the chrome from auto-hiding while the overlay is open.

---

## Verdict

The core feature is correct and complete. Two of the three issues above are small enough to be addressed in a follow-up, but Issue 1 (error state unreachable + silent failure UX) directly contradicts the acceptance criterion for graceful failure and is a straightforward fix. Issue 3 (OK repeat) is a direct quote from the ticket's remote interaction requirements.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T135/reviews/implementation-review.md
- generated at: 2026-08-27T09:02:36Z

---

I have all the information needed. Here is the structured review.

---

# PR Review — T135: Android TV Live Channel Selector Overlay

## Summary

The implementation covers the full scope of the ticket: a persistent left-side channel selector overlay, in-place channel switching, correct focus management, EPG display, BACK/RIGHT close hierarchy, and ViewModel + unit tests. The VOD player controls are untouched. No regressions were introduced.

---

## Acceptance Criteria Coverage

| Criterion | Status | Notes |
|---|---|---|
| DPAD_LEFT opens overlay during Live playback | ✅ | Fires only when `mediaType == "channel"` and chrome is hidden (correct: no conflict with VOD seek) |
| Overlay shows logo/name/EPG | ✅ | Initials fallback, graceful EPG-absent rendering |
| DPAD_UP/DOWN with orange focus | ✅ | `TvLazyColumn` + `TvColors.LiveTvAccent` focus background |
| OK switches channel, overlay stays open | ✅ | `onChannelSelected` does not set `isChannelSelectorOpen = false` |
| Focus remains deterministic after switch | ✅ | `currentChannelId` updated immediately; `requestInitialFocus` propagated via index match |
| Current channel visually identified | ✅ | Orange tinted background + `▶` glyph on `isCurrentlyPlaying` row |
| BACK closes overlay first | ✅ | Back hierarchy at PlayerScreen lines 251–273 checks overlay before panel/chrome/exit |
| RIGHT closes overlay | ✅ | Lines 280–284 |
| EPG/no-EPG both render | ✅ | `if (channel.epg?.now != null)` guard, no placeholder crash |
| No ChannelSource duplicates | ✅ | Backend-delegated, per plan; no client-side dedup required |
| Channel switch uses failover path | ✅ | `switchChannel → load → PlaybackResolver` — identical path to all other playback |
| Loading state during switch | ✅ | `loadingChannelId` shows per-row spinner; cleared on `Playing` or `Error` |
| Tests | ✅ / partial | See below |
| VOD controls not regressed | ✅ | DPAD_LEFT only opens overlay for `mediaType == "channel"`; VOD seek path unchanged |

---

## Issues

### Medium — `LiveChannelSelectorState.Error` is unreachable in production

**File:** `livetv/ChannelRepository.kt` + `livetv/LiveChannelSelectorViewModel.kt`

`ChannelRepository.allChannels()` wraps `api.getChannels()` in `runCatching` and returns `emptyList()` on failure — it never throws. The `runCatching` in `LiveChannelSelectorViewModel.load()` therefore always sees a success result. The `Error` state can never be set at runtime.

Consequence: when the channel list fails to load (e.g., network outage), the overlay shows the "Chaînes" header with an empty `TvLazyColumn` and no explanatory message. The ticket requires failure to be handled gracefully; an unexplained empty panel is not graceful.

The `LiveChannelSelectorViewModelTest` test `Repository failure surfaces as Error` mocks the repository to throw directly, which bypasses this swallowing — so the test passes but validates a code path that production code cannot reach.

**Fix options (pick one):**
```kotlin
// Option A: propagate from ChannelRepository
suspend fun allChannels(): List<ChannelResponse> = api.getChannels()
// LiveChannelSelectorViewModel's runCatching then works as designed.

// Option B: targeted helper that propagates, leaving existing callers unchanged
suspend fun allChannelsOrThrow(): List<ChannelResponse> = api.getChannels()
// LiveChannelSelectorViewModel calls allChannelsOrThrow() instead.
```

Note: the same pattern exists in `LiveTvHomeViewModel` from T134, but `LiveTvHomeViewModel` shows an error screen — so fixing it there too would be worthwhile.

---

### Minor — Empty Ready state has no empty-list message in overlay

**File:** `livetv/LiveChannelSelectorOverlay.kt` (line 109–124)

When `state is LiveChannelSelectorState.Ready` but `channels.isEmpty()`, the `TvLazyColumn` renders with no items and no message. Depending on how Issue 1 is resolved (if error propagates, this can only happen when the backend returns zero channels), adding a fallback message is a small robustness improvement:

```kotlin
if (state.channels.isEmpty()) {
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text("Aucune chaîne disponible", color = TvColors.TextMuted, fontSize = 13.sp)
    }
} else {
    TvLazyColumn(…) { … }
}
```

---

### Minor — No OK-press guard in channel selector (d-pad repeat)

The ticket explicitly requires "D-pad repeat should be handled sanely and not trigger accidental multiple OK selections."

`ChannelSelectorRow.Surface` uses the TV library's click dispatch. Holding ENTER could fire `onChannelSelected` multiple times in quick succession. Each call produces a new UUID command (bypassing `loadedCommandId` dedup in `PlayerViewModel.load`), triggering redundant loads. No crash, but unnecessary thrashing.

A simple guard in the `onChannelSelected` callback:
```kotlin
onChannelSelected = { ch ->
    if (loadingChannelId == null) {   // guard: ignore if a switch is already in-flight
        loadingChannelId = ch.id
        currentChannelId = ch.id
        vm.switchChannel(ch.id, ch.name, ch.logoUrl)
    }
},
```

---

### Observation — `ModeSwitchTest` tests trivial lambdas, not real components

`ModeSwitchTest` assigns string constants via lambdas and asserts on those strings. This validates no actual Kotlin/Compose/navigation logic. It passes by construction and would not catch any real regression. It is harmless but provides no coverage value.

---

## Architecture & Scope

- Scope: bounded correctly to the player + LiveTv home wiring. No changes outside the declared plan perimeter.
- `PlayerOverlayStack` (pre-T134): channel selector is correctly mounted in `chromeContent` (layer 4), above video, status, and action overlays.
- The `LiveChannelSelectorViewModel` is scoped to `PlayerScreen` via `viewModel()`, and the channel list is fetched once per player session (not per switch). Cache invalidation is tied to screen lifecycle — correct.
- `formatEpgTime` handles both ISO 8601 (`"2026-08-27T18:00:00Z"` → `"18:00"`) and plain time strings gracefully.
- `LaunchedEffect(requestInitialFocus)` pattern for focus is consistent with the existing `EpisodeRow` / `ChannelCard` / `CheckOption` pattern throughout the codebase.
- `isChannelSelectorOpen` is included in the auto-hide `LaunchedEffect` keys, correctly preventing the chrome from auto-hiding while the overlay is open.

---

## Verdict

The core feature is correct and complete. Two of the three issues above are small enough to be addressed in a follow-up, but Issue 1 (error state unreachable + silent failure UX) directly contradicts the acceptance criterion for graceful failure and is a straightforward fix. Issue 3 (OK repeat) is a direct quote from the ticket's remote interaction requirements.

IMPLEMENTATION_FIX_REQUIRED