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
