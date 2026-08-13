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


# T056 — Build minimal Android TV companion player with Media3 and remote-command support

**Source**: GitHub Issue #105

## Description

## Objective

Turn the existing Android TV project skeleton into a deliberately simple IPTVFlix playback companion: pair once, stay connected to IPTVFlix, receive remote play commands, and play Movies/Episodes reliably with Media3.

## Product intent

Do not duplicate the full Web application on TV in this phase. The primary interaction is: choose content on phone/desktop Web → tap `Play on TV` → the Android TV app launches playback. The TV app should also remain usable with a remote for basic playback and status.

## Included

- Build on the existing `apps/android-tv` project using Kotlin + Jetpack Compose for TV and AndroidX Media3.
- Add first-run pairing UI showing the pairing code and/or QR value from the backend device-pairing flow (#104).
- Persist the paired device credential securely on-device.
- Maintain the backend command connection and reconnect with bounded backoff after network/app interruptions.
- On a valid remote playback command:
  - resolve the canonical Movie/Episode through the secure playback API from #99;
  - start playback with Media3;
  - honor requested/resume position;
  - acknowledge command state so it is not replayed accidentally.
- Provide a minimal TV home/idle screen showing device name/status and, when available, current/recent media artwork/title.
- Add TV-remote controls for play/pause, seek, back/stop and track selection where Media3 exposes it safely.
- Support audio/subtitle tracks and surface the selected Availability/variant semantics from the backend rather than inventing TV-side ranking.
- Report viewing progress periodically and on pause/stop to the existing IPTVFlix progress model.
- Handle unsupported codecs/stream errors with a usable TV error state instead of crashing.
- Keep source credentials out of general app state/logging; use only the dedicated playback descriptor/session contract.
- Add enough instrumentation/tests to validate command parsing, pairing state, reconnect behavior, progress updates and Media3 item construction without requiring a real IPTV account.

## Acceptance Criteria

- [ ] A fresh install can pair with an IPTVFlix account/device flow.
- [ ] After pairing, opening the app shows a simple ready/connected state rather than a duplicated Web catalog.
- [ ] Sending a valid Movie command from the backend starts playback automatically.
- [ ] Sending an Episode command starts the correct episode and supports resume position.
- [ ] Play/pause/seek/back work with a standard Android TV remote.
- [ ] Playback progress is written back to the shared profile/Continue Watching state.
- [ ] Audio/subtitle selection is available when the stream exposes tracks.
- [ ] Network reconnect does not duplicate playback commands.
- [ ] Revoking the TV device stops future authenticated command delivery.
- [ ] Playback failures show a clear recoverable error state.

## Excluded / Out of scope

- Full Netflix-style TV browsing/catalog UI.
- TV-native recommendations/shelves.
- Trailer autoplay browsing previews.
- Live TV/EPG.
- Chromecast receiver implementation.

## Dependencies

Depends on #104 for device pairing/commands and #99 for secure playback resolution. Must remain compatible with #95 authentication.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary of everything created:

---

## Files modified (4)

| File | Change |
|---|---|
| `gradle/libs.versions.toml` | Added 17 new dependency versions (Media3, Compose TV, OkHttp, serialization, security-crypto, ZXing, etc.) and 4 plugins |
| `app/build.gradle.kts` | Enabled Compose + buildConfig, added all dependencies, raised minSdk to 23, added `testOptions.isReturnDefaultValues = true` |
| `app/src/main/AndroidManifest.xml` | Added `INTERNET` permission, `android:name=".App"`, `Theme.Material.NoActionBar` |
| `app/src/main/kotlin/.../MainActivity.kt` | Replaced `AppCompatActivity` stub with `ComponentActivity + setContent { AppNavGraph() }` |

## New source files (24)

| Layer | Files |
|---|---|
| App | `App.kt` — singleton container (secureStorage, apiClient, sseClient) |
| Storage | `TokenStore.kt` (interface), `SecureStorage.kt` (EncryptedSharedPreferences) |
| Network | `ApiClient.kt` (OkHttp + token interceptor), `SseClient.kt` (Flow<String> with bounded backoff, 1s→60s) |
| Pairing | `PairingApi.kt`, `PairingRepository.kt` (state machine: Idle→Requesting→PollingCode→Approved/Expired), `PairingViewModel.kt`, `PairingScreen.kt` (QR + code display) |
| Commands | `CommandModels.kt`, `CommandParser.kt` (pure JSON→`PlaybackCommand?`), `CommandRepository.kt` (SSE with dedup + 3-failure poll fallback), `CommandViewModel.kt` |
| Playback | `PlaybackApi.kt` (assumes #99 route `GET /playback/{type}/{id}`), `PlaybackResolver.kt` |
| Player | `MediaItemBuilder.kt` (pure `PlaybackDescriptor→MediaItemSpec`), `PlayerViewModel.kt` (ExoPlayer lifecycle), `PlayerScreen.kt` (D-pad overlay, track panel, error state) |
| Progress | `ProgressReporter.kt` (15s periodic + on-pause reports) |
| Home | `HomeViewModel.kt` (device name, connection status, continue-watching), `HomeScreen.kt` |
| Nav | `AppNavGraph.kt` (state-based: Pairing↔Home↔Player) |

## Test files (5)

`CommandParserTest` · `PairingStateMachineTest` · `ReconnectBackoffTest` · `ProgressReporterTest` · `MediaItemBuilderTest` — all runnable via `./gradlew :app:test` (JVM, no real device needed).

## Key assumptions noted in code
- Playback API route assumed from #99: `GET /playback/{mediaType}/{mediaId}?availabilityId=…`  — isolated in `PlaybackApi.kt`
- `GET /devices/me` assumed to exist from #104 — only used in `HomeViewModel`

---

## Review

Now I have everything I need to write the structured review.

---

# PR Review — T056: Android TV Companion Player (Media3 + Remote Commands)

## Résumé

The implementation delivers a coherent Android TV companion skeleton covering pairing, SSE command reception, Media3 playback, progress reporting, and the idle home screen. Architecture is clean, navigation state machine is correct, test coverage addresses the five required areas, and security properties (encrypted storage, no token leakage in logs) are properly observed. However, three concrete defects prevent full acceptance: the track-selection feature is stubbed with no implementation, `_availableTracks` is populated from the wrong source (API model instead of ExoPlayer `Tracks.Group`), and the final progress report in `onCleared()` is structurally guaranteed to be lost due to a coroutine lifecycle race.

---

## Vérifications effectuées

- Full source tree under `apps/android-tv/app/src/` read in detail
- All five test files reviewed
- Plan (`runs/T056/plan.md`) cross-referenced against each acceptance criterion
- `PlayerViewModel`, `PlayerScreen`, `ProgressReporter`, `CommandRepository`, `SseClient`, `SecureStorage`, `ApiClient` read in full
- `build.gradle.kts`, `AppNavGraph`, `MediaItemBuilder` reviewed

---

## Points validés

- **Pairing state machine** — `Idle → Requesting → PollingCode → Approved | Expired` is correctly implemented; token saved to `EncryptedSharedPreferences` on approval; re-request on expiry works (AC 1).
- **Home idle screen** — Shows device name + connection status, no catalog grid, "Waiting for play command…" copy (AC 2).
- **SSE command delivery** — `SseClient` correctly parses `data:` lines, filters keep-alives, rethrows `UnauthorizedException` for 401 (AC 3, 9).
- **Bounded exponential backoff** — 1 s → 2 s → … → 60 s cap, verified by `ReconnectBackoffTest` (AC 8).
- **Command deduplication** — `acknowledgedIds` synchronized set prevents replay after reconnect; ack posted immediately (AC 8).
- **Polling fallback** — Falls back to `GET /devices/me/commands` after 3 SSE failures (plan requirement).
- **Resume position** — `player.seekTo(command.startPositionMs)` correctly set before `playWhenReady` (AC 4).
- **D-pad controls** — `Key.DirectionCenter` → play/pause, `Key.DirectionLeft/Right` → ±10 s, `Key.Back` → stop + navigate home (AC 5).
- **Error state** — `ErrorOverlay` with Retry/Back, no crash path (AC 10).
- **Revocation** — 401 from SSE → `onRevoked()` → token cleared → back to Pairing screen (AC 9).
- **Secure storage** — `EncryptedSharedPreferences` with AES256-GCM, no token in logs (plan security constraint).
- **DRM-aware `MediaItem`** — Widevine UUID parsed safely, absent DRM → plain `MediaItem` (AC 3).
- **`BuildConfig.API_BASE_URL`** — Defined in `build.gradle.kts` line 18; build does not fail from a missing field.
- **Unit tests** — All five required test files present; `CommandParserTest` (8 cases), `PairingStateMachineTest` (4 cases), `ReconnectBackoffTest` (3 cases), `MediaItemBuilderTest` (5 cases), `ProgressReporterTest` (4 cases).

---

## Problèmes détectés

### 🔴 Bloquant 1 — `selectTrack()` est un stub sans implémentation

**Fichier**: `player/PlayerViewModel.kt:117–120`

```kotlin
fun selectTrack(trackId: String) {
    // Track selection hook — wires to ExoPlayer TrackSelectionParameters
    // when track group index is resolvable from the descriptor.
}
```

`PlayerScreen.kt:122` appelle `vm.selectTrack(it)` depuis `TrackSelectorPanel`, mais rien ne se passe. Le critère d'acceptation du ticket est explicite : "Audio/subtitle selection is available when the stream exposes tracks." C'est un critère non rempli.

---

### 🔴 Bloquant 2 — `_availableTracks` peuplé depuis le mauvais modèle ; `onTracksChanged` non implémenté

**Fichier**: `player/PlayerViewModel.kt:76`

```kotlin
_availableTracks.value = descriptor.tracks   // modèle API (TrackInfo), pas ExoPlayer Tracks
```

Le plan stipule explicitement : "surfaces available audio/subtitle track groups from `Player.Listener.onTracksChanged`". Sans ce listener, `selectTrack(trackId: String)` n'a aucun moyen de résoudre le `Tracks.Group` ExoPlayer correspondant pour appeler `trackSelectionParameters`. Le chaîne entière sélection piste → ExoPlayer est structurellement cassée : même si `selectTrack()` était implémenté, la référence nécessaire (`TrackGroup` / index) n'est pas disponible.

**Correction attendue** :
1. Ajouter `onTracksChanged` dans le `Player.Listener` de `init` pour peupler `_availableTracks` depuis `tracks.groups` ExoPlayer, en mappant vers des `TrackInfo` annotés du group index.
2. Implémenter `selectTrack()` via `player.trackSelectionParameters = player.trackSelectionParameters.buildUpon().clearOverrides().addOverride(TrackSelectionOverride(group.mediaTrackGroup, listOf(trackIndex))).build()`.

---

### 🔴 Bloquant 3 — Race condition : rapport de progression final perdu dans `onCleared()`

**Fichier**: `player/PlayerViewModel.kt:122–127`

```kotlin
override fun onCleared() {
    viewModelScope.launch { progressReporter?.reportNow() }  // ← lancé dans viewModelScope...
    reporterJob?.cancel()
    player.release()
    super.onCleared()  // ← ...mais viewModelScope est annulé ici → reportNow() ne s'exécute jamais
}
```

`viewModelScope` est lié au `ViewModel` ; il est annulé pendant ou juste après `onCleared()`. Le coroutine lancé ne s'exécutera jamais. Le plan requiert "also reports on... `PlayerViewModel.onCleared`" et l'AC 6 exige que la progression soit écrite à l'arrêt.

**Correction attendue** : Utiliser `runBlocking` avec timeout, ou appeler `reportNow()` de façon synchrone (en le rendant non-suspend), ou utiliser un scope non lié au ViewModel (e.g. `GlobalScope` avec timeout borné) pour ce dernier appel.

---

### 🟡 Mineur 1 — `MasterKeys` API dépréciée

**Fichier**: `storage/SecureStorage.kt:12–18`

`MasterKeys.getOrCreate()` est déprécié depuis Security Crypto 1.1.0. Remplacer par :
```kotlin
MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()
```

---

### 🟡 Mineur 2 — Local `Collections` wrapper superflu

**Fichier**: `command/CommandRepository.kt:87–90`

Un objet local nommé `Collections` est défini pour envelopper `java.util.Collections.synchronizedSet`. Ce pattern masque la bibliothèque standard, crée une confusion de nommage, et sert aucun but. Utiliser directement `java.util.Collections.synchronizedSet(mutableSetOf<String>())` avec un import explicite.

---

### 🟡 Mineur 3 — Absence de test pour la transition SSE → polling

`ReconnectBackoffTest` vérifie le calcul du backoff et la déduplication, mais pas le comportement de fallback lui-même (après 3 échecs SSE consécutifs → bascule en polling). Le plan cite explicitement "SSE reconnect replays only unacknowledged commands" comme cas à tester. Un test de la transition manque.

---

### 🟡 Mineur 4 — Test `MediaItemBuilderTest` #4 : nom trompeur

**Fichier**: `player/MediaItemBuilderTest.kt:50–56`

Le test "startPositionMs is propagated through the command to load call" ne vérifie pas `startPositionMs` — il ne fait que vérifier l'URI de la spec. Le nom du test est trompeur pour un futur lecteur. Renommer ou élargir le test pour refléter ce qu'il vérifie réellement.

---

### ⚪ Observation — `acknowledgedIds` set non borné

Le `MutableSet<String>` des IDs acquittés ne dispose d'aucune politique d'éviction. Pour un processus TV longue durée avec un volume élevé de commandes, la mémoire croît indéfiniment. Acceptable dans le scope du ticket mais à noter pour une version future.

---

## Risques éventuels

- **Bloquant 3** : Sur les appareils où `onCleared()` est appelé rapidement (ex. rotation, processus kill), le dernier point de progression n'est pas enregistré, cassant l'état "Continue Watching" — impact utilisateur direct sur AC 6.
- **Bloquants 1 & 2** : La sélection de piste audio/sous-titre est entièrement non fonctionnelle malgré la présence visible du panel UI, ce qui crée une fausse impression de feature complète.

---

## Décision

REQUEST_CHANGES

Trois critères d'acceptation ne sont pas remplis :
- AC 7 ("Audio/subtitle selection available") → stub + mauvais modèle de tracks
- AC 6 ("Playback progress written back on stop") → race condition sur `onCleared`

---

## Actions demandées

1. **[Bloquant]** Implémenter `onTracksChanged` dans le `Player.Listener` de `PlayerViewModel.init` pour peupler `_availableTracks` depuis les `Tracks.Group` ExoPlayer réels, avec l'index de groupe inclus dans chaque entrée.
2. **[Bloquant]** Implémenter `selectTrack()` avec `player.trackSelectionParameters.buildUpon().clearOverrides().addOverride(...)`.
3. **[Bloquant]** Corriger `onCleared()` pour garantir que `reportNow()` s'exécute avant la libération du player — utiliser `runBlocking(NonCancellable)` ou rendre le rapport synchrone.
4. **[Mineur]** Migrer `SecureStorage` de `MasterKeys` vers `MasterKey.Builder`.
5. **[Mineur]** Supprimer le local `Collections` wrapper et appeler `java.util.Collections.synchronizedSet` directement.
6. **[Mineur]** Ajouter un test vérifiant la transition SSE → polling après 3 échecs.
7. **[Mineur]** Corriger le nom du test `MediaItemBuilderTest` #4 pour refléter ce qu'il teste réellement.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T056/reviews/implementation-review.md
- generated at: 2026-08-13T02:08:50Z

---

Now I have everything I need to write the structured review.

---

# PR Review — T056: Android TV Companion Player (Media3 + Remote Commands)

## Résumé

The implementation delivers a coherent Android TV companion skeleton covering pairing, SSE command reception, Media3 playback, progress reporting, and the idle home screen. Architecture is clean, navigation state machine is correct, test coverage addresses the five required areas, and security properties (encrypted storage, no token leakage in logs) are properly observed. However, three concrete defects prevent full acceptance: the track-selection feature is stubbed with no implementation, `_availableTracks` is populated from the wrong source (API model instead of ExoPlayer `Tracks.Group`), and the final progress report in `onCleared()` is structurally guaranteed to be lost due to a coroutine lifecycle race.

---

## Vérifications effectuées

- Full source tree under `apps/android-tv/app/src/` read in detail
- All five test files reviewed
- Plan (`runs/T056/plan.md`) cross-referenced against each acceptance criterion
- `PlayerViewModel`, `PlayerScreen`, `ProgressReporter`, `CommandRepository`, `SseClient`, `SecureStorage`, `ApiClient` read in full
- `build.gradle.kts`, `AppNavGraph`, `MediaItemBuilder` reviewed

---

## Points validés

- **Pairing state machine** — `Idle → Requesting → PollingCode → Approved | Expired` is correctly implemented; token saved to `EncryptedSharedPreferences` on approval; re-request on expiry works (AC 1).
- **Home idle screen** — Shows device name + connection status, no catalog grid, "Waiting for play command…" copy (AC 2).
- **SSE command delivery** — `SseClient` correctly parses `data:` lines, filters keep-alives, rethrows `UnauthorizedException` for 401 (AC 3, 9).
- **Bounded exponential backoff** — 1 s → 2 s → … → 60 s cap, verified by `ReconnectBackoffTest` (AC 8).
- **Command deduplication** — `acknowledgedIds` synchronized set prevents replay after reconnect; ack posted immediately (AC 8).
- **Polling fallback** — Falls back to `GET /devices/me/commands` after 3 SSE failures (plan requirement).
- **Resume position** — `player.seekTo(command.startPositionMs)` correctly set before `playWhenReady` (AC 4).
- **D-pad controls** — `Key.DirectionCenter` → play/pause, `Key.DirectionLeft/Right` → ±10 s, `Key.Back` → stop + navigate home (AC 5).
- **Error state** — `ErrorOverlay` with Retry/Back, no crash path (AC 10).
- **Revocation** — 401 from SSE → `onRevoked()` → token cleared → back to Pairing screen (AC 9).
- **Secure storage** — `EncryptedSharedPreferences` with AES256-GCM, no token in logs (plan security constraint).
- **DRM-aware `MediaItem`** — Widevine UUID parsed safely, absent DRM → plain `MediaItem` (AC 3).
- **`BuildConfig.API_BASE_URL`** — Defined in `build.gradle.kts` line 18; build does not fail from a missing field.
- **Unit tests** — All five required test files present; `CommandParserTest` (8 cases), `PairingStateMachineTest` (4 cases), `ReconnectBackoffTest` (3 cases), `MediaItemBuilderTest` (5 cases), `ProgressReporterTest` (4 cases).

---

## Problèmes détectés

### 🔴 Bloquant 1 — `selectTrack()` est un stub sans implémentation

**Fichier**: `player/PlayerViewModel.kt:117–120`

```kotlin
fun selectTrack(trackId: String) {
    // Track selection hook — wires to ExoPlayer TrackSelectionParameters
    // when track group index is resolvable from the descriptor.
}
```

`PlayerScreen.kt:122` appelle `vm.selectTrack(it)` depuis `TrackSelectorPanel`, mais rien ne se passe. Le critère d'acceptation du ticket est explicite : "Audio/subtitle selection is available when the stream exposes tracks." C'est un critère non rempli.

---

### 🔴 Bloquant 2 — `_availableTracks` peuplé depuis le mauvais modèle ; `onTracksChanged` non implémenté

**Fichier**: `player/PlayerViewModel.kt:76`

```kotlin
_availableTracks.value = descriptor.tracks   // modèle API (TrackInfo), pas ExoPlayer Tracks
```

Le plan stipule explicitement : "surfaces available audio/subtitle track groups from `Player.Listener.onTracksChanged`". Sans ce listener, `selectTrack(trackId: String)` n'a aucun moyen de résoudre le `Tracks.Group` ExoPlayer correspondant pour appeler `trackSelectionParameters`. Le chaîne entière sélection piste → ExoPlayer est structurellement cassée : même si `selectTrack()` était implémenté, la référence nécessaire (`TrackGroup` / index) n'est pas disponible.

**Correction attendue** :
1. Ajouter `onTracksChanged` dans le `Player.Listener` de `init` pour peupler `_availableTracks` depuis `tracks.groups` ExoPlayer, en mappant vers des `TrackInfo` annotés du group index.
2. Implémenter `selectTrack()` via `player.trackSelectionParameters = player.trackSelectionParameters.buildUpon().clearOverrides().addOverride(TrackSelectionOverride(group.mediaTrackGroup, listOf(trackIndex))).build()`.

---

### 🔴 Bloquant 3 — Race condition : rapport de progression final perdu dans `onCleared()`

**Fichier**: `player/PlayerViewModel.kt:122–127`

```kotlin
override fun onCleared() {
    viewModelScope.launch { progressReporter?.reportNow() }  // ← lancé dans viewModelScope...
    reporterJob?.cancel()
    player.release()
    super.onCleared()  // ← ...mais viewModelScope est annulé ici → reportNow() ne s'exécute jamais
}
```

`viewModelScope` est lié au `ViewModel` ; il est annulé pendant ou juste après `onCleared()`. Le coroutine lancé ne s'exécutera jamais. Le plan requiert "also reports on... `PlayerViewModel.onCleared`" et l'AC 6 exige que la progression soit écrite à l'arrêt.

**Correction attendue** : Utiliser `runBlocking` avec timeout, ou appeler `reportNow()` de façon synchrone (en le rendant non-suspend), ou utiliser un scope non lié au ViewModel (e.g. `GlobalScope` avec timeout borné) pour ce dernier appel.

---

### 🟡 Mineur 1 — `MasterKeys` API dépréciée

**Fichier**: `storage/SecureStorage.kt:12–18`

`MasterKeys.getOrCreate()` est déprécié depuis Security Crypto 1.1.0. Remplacer par :
```kotlin
MasterKey.Builder(context)
    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
    .build()
```

---

### 🟡 Mineur 2 — Local `Collections` wrapper superflu

**Fichier**: `command/CommandRepository.kt:87–90`

Un objet local nommé `Collections` est défini pour envelopper `java.util.Collections.synchronizedSet`. Ce pattern masque la bibliothèque standard, crée une confusion de nommage, et sert aucun but. Utiliser directement `java.util.Collections.synchronizedSet(mutableSetOf<String>())` avec un import explicite.

---

### 🟡 Mineur 3 — Absence de test pour la transition SSE → polling

`ReconnectBackoffTest` vérifie le calcul du backoff et la déduplication, mais pas le comportement de fallback lui-même (après 3 échecs SSE consécutifs → bascule en polling). Le plan cite explicitement "SSE reconnect replays only unacknowledged commands" comme cas à tester. Un test de la transition manque.

---

### 🟡 Mineur 4 — Test `MediaItemBuilderTest` #4 : nom trompeur

**Fichier**: `player/MediaItemBuilderTest.kt:50–56`

Le test "startPositionMs is propagated through the command to load call" ne vérifie pas `startPositionMs` — il ne fait que vérifier l'URI de la spec. Le nom du test est trompeur pour un futur lecteur. Renommer ou élargir le test pour refléter ce qu'il vérifie réellement.

---

### ⚪ Observation — `acknowledgedIds` set non borné

Le `MutableSet<String>` des IDs acquittés ne dispose d'aucune politique d'éviction. Pour un processus TV longue durée avec un volume élevé de commandes, la mémoire croît indéfiniment. Acceptable dans le scope du ticket mais à noter pour une version future.

---

## Risques éventuels

- **Bloquant 3** : Sur les appareils où `onCleared()` est appelé rapidement (ex. rotation, processus kill), le dernier point de progression n'est pas enregistré, cassant l'état "Continue Watching" — impact utilisateur direct sur AC 6.
- **Bloquants 1 & 2** : La sélection de piste audio/sous-titre est entièrement non fonctionnelle malgré la présence visible du panel UI, ce qui crée une fausse impression de feature complète.

---

## Décision

REQUEST_CHANGES

Trois critères d'acceptation ne sont pas remplis :
- AC 7 ("Audio/subtitle selection available") → stub + mauvais modèle de tracks
- AC 6 ("Playback progress written back on stop") → race condition sur `onCleared`

---

## Actions demandées

1. **[Bloquant]** Implémenter `onTracksChanged` dans le `Player.Listener` de `PlayerViewModel.init` pour peupler `_availableTracks` depuis les `Tracks.Group` ExoPlayer réels, avec l'index de groupe inclus dans chaque entrée.
2. **[Bloquant]** Implémenter `selectTrack()` avec `player.trackSelectionParameters.buildUpon().clearOverrides().addOverride(...)`.
3. **[Bloquant]** Corriger `onCleared()` pour garantir que `reportNow()` s'exécute avant la libération du player — utiliser `runBlocking(NonCancellable)` ou rendre le rapport synchrone.
4. **[Mineur]** Migrer `SecureStorage` de `MasterKeys` vers `MasterKey.Builder`.
5. **[Mineur]** Supprimer le local `Collections` wrapper et appeler `java.util.Collections.synchronizedSet` directement.
6. **[Mineur]** Ajouter un test vérifiant la transition SSE → polling après 3 échecs.
7. **[Mineur]** Corriger le nom du test `MediaItemBuilderTest` #4 pour refléter ce qu'il teste réellement.

IMPLEMENTATION_FIX_REQUIRED