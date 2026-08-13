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

All files look correct. Here's a summary of every change made:

---

## Changes applied

**3 blockers fixed:**

| File | Fix |
|---|---|
| `player/PlayerViewModel.kt` | Added `onTracksChanged` in the `Player.Listener` — maps ExoPlayer `Tracks.Group` objects to `TrackInfo` + builds `exoTracksMap` keyed by generated IDs. `_availableTracks` is now populated from the real ExoPlayer event instead of the API descriptor. |
| `player/PlayerViewModel.kt` | Implemented `selectTrack()` — looks up the `ExoTrackRef` from `exoTracksMap` and calls `player.trackSelectionParameters.buildUpon().clearOverrides().addOverride(TrackSelectionOverride(...)).build()`. |
| `player/PlayerViewModel.kt` | Fixed `onCleared()` — replaced `viewModelScope.launch { reportNow() }` (which was dropped when the scope cancelled) with `runBlocking(NonCancellable) { runCatching { withTimeout(2_000L) { reportNow() } } }`. |

**4 minors fixed:**

| File | Fix |
|---|---|
| `storage/SecureStorage.kt` | Migrated from deprecated `MasterKeys.getOrCreate()` to `MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()`. Updated `EncryptedSharedPreferences.create()` to the new signature. |
| `command/CommandRepository.kt` | Removed the local `private object Collections` wrapper; `acknowledgedIds` now calls `java.util.Collections.synchronizedSet(...)` directly. |
| `command/ReconnectBackoffTest.kt` | Added `after 3 SSE failures repository switches to polling` — mocks SSE to throw `IOException`, verifies `commandStream()` is called exactly 3 times and the resulting command comes from the poll endpoint. |
| `player/MediaItemBuilderTest.kt` | Renamed test #4 from the misleading `startPositionMs is propagated through the command to load call` to `descriptor streamUrl is preserved as spec uri`, which accurately describes what the assertion checks. |

---

## Review

Now I have enough information to write the review. Let me produce the structured review.

---

# PR Review — T056: Android TV Companion Player

## Résumé

L'implémentation couvre l'ensemble du scope T056 : flux de pairing, réception de commandes SSE, lecture Media3, signalement de progression et contrôles de télécommande. La structure MVVM + Compose for TV est cohérente, la sécurité des credentials est solide, et les tests unitaires couvrent les chemins principaux. Un problème d'architecture modéré entre `SseClient` et `CommandRepository` rend le fallback polling dead code en production et invalide le test qui prétend le valider.

---

## Vérifications effectuées

- Lecture de tous les fichiers source de `apps/android-tv/`
- Lecture des 5 fichiers de tests
- Vérification de la concordance avec les 10 critères d'acceptation du ticket
- Analyse du flux de reconnexion SSE / fallback polling
- Inspection de la gestion sécurisée du token
- Vérification de `PlayerViewModel.onCleared()` / flush progress
- Analyse de `selectTrack()` et `clearOverrides()`

---

## Points validés

- **Pairing** : `PairingScreen` affiche le code 8 caractères + QR (ZXing), `PairingRepository` implémente la machine d'états `Idle → Approved | Expired`. Token stocké dans `EncryptedSharedPreferences` AES256-GCM / Android Keystore.
- **Sécurité credentials** : Token jamais loggué, isolation via `TokenStore`, révocation sur 401 via `onRevoked()` callback. ✅
- **Commandes SSE** : `SseClient.commandStream()` retente avec backoff exponentiel borné (`1s → 2s → 4s → ... → 60s`). Le parser `CommandParser` retourne null sur champ manquant, JSON malformé, ou id vide. ✅
- **Déduplication** : `CommandRepository` maintient un `synchronizedSet` d'ids acquittés + appel immédiat à `POST /devices/me/commands/{id}/ack`. ✅
- **Lecture Media3** : `MediaItemBuilder` construit les `MediaItem` avec DRM optionnel (UUID parsing isolé). `player.seekTo(command.startPositionMs)` honore la position de reprise. ✅
- **Pistes audio/sous-titres** : `onTracksChanged` mappe les `Tracks.Group` ExoPlayer vers `TrackInfo`, `selectTrack()` applique un `TrackSelectionOverride`. ✅
- **Progression** : `ProgressReporter` envoie `PUT /progress/{type}/{id}` toutes les 15s en lecture + `reportNow()` sur pause/stop. ✅
- **Flush final** : `onCleared()` utilise `runBlocking(NonCancellable) { withTimeout(2000L) { reportNow() } }` — correctement protégé contre l'annulation du scope. ✅
- **Erreurs de lecture** : `PlayerUiState.Error` + `ErrorOverlay` avec retry/back, sans crash. ✅
- **Écran home** : `HomeScreen` affiche nom de device, indicateur de connexion (Connected / Reconnecting / Revoked), dernier média joué. ✅
- **Tests** : 5 fichiers couvrant parsing, pairing, backoff, progression, MediaItem builder — aucun accès réseau réel requis. ✅

---

## Problèmes détectés

### [MODÉRÉ] Fallback polling dead code — test invalide (`CommandRepository` + `ReconnectBackoffTest`)

**Localisation :** `command/CommandRepository.kt:28-70`, `command/ReconnectBackoffTest.kt:55-72`

`SseClient.commandStream()` est un flow infini qui capture toutes les exceptions réseau en interne et les retente avec backoff (le `catch (e: Exception)` dans SseClient délaye puis continue le `while (currentCoroutineContext().isActive)`). Il ne propagea jamais une exception non-auth / non-cancellation au collecteur.

Conséquence : dans `CommandRepository.commands()`, le bloc `catch (e: Exception) { sseFailed++ }` ne peut jamais être atteint avec le vrai `SseClient`. Le compteur `sseFailed` reste à 0 en permanence — le mode polling est unreachable en production.

Le test `"after 3 SSE failures repository switches to polling"` contourne ce problème en mockant `commandStream()` pour lancer directement une `IOException`, ce qui est impossible avec l'implémentation réelle. Le test passe mais valide un comportement fictif.

**Options de correction :**

Option A — Propagation après N échecs (architecture cohérente) : faire terminer `SseClient.commandStream()` normalement (sans exception) après `MAX_ATTEMPT` tentatives consécutives. `CommandRepository` voit le flow se terminer, `sseFailed` n'est pas incrémenté mais le while boucle vers le fallback polling via un état interne. *Attention : nécessite de revoir la sémantique du reset `sseFailed = 0`.*

Option B — plus propre : supprimer le fallback polling de `CommandRepository` (SseClient gère déjà la reconnexion), et reformuler le test pour valider le comportement réel (backoff dans SseClient, déduplication dans CommandRepository). Le test `backoff sequence` et `capped at 60s` restent valides. Supprimer ou remplacer le test de polling fallback par un test vérifiant que les connexions SSE réussies réinitialisent le compteur.

---

### [MINEUR] `selectTrack()` efface toutes les overrides — audio et sous-titre ne peuvent pas coexister

**Localisation :** `player/PlayerViewModel.kt:152-158`

```kotlin
.buildUpon()
.clearOverrides()  // efface l'override audio si on sélectionne un sous-titre
.addOverride(...)
```

Sélectionner un sous-titre efface l'override audio explicite et vice-versa. Acceptable pour un compagnon minimaliste, mais peut dérouter l'utilisateur qui change de langue audio après avoir activé des sous-titres.

**Correction possible :** utiliser `setOverrideForType()` ciblant uniquement le type de piste concerné, ou maintenir deux overrides séparés (un par type).

---

### [MINEUR] `stop()` : progression reportée de façon async sans garantie de livraison

**Localisation :** `player/PlayerViewModel.kt:144-149`

```kotlin
fun stop() {
    viewModelScope.launch { progressReporter?.reportNow() }  // asynchrone
    reporterJob?.cancel()
    player.stop()
```

`reportNow()` est lancé dans un coroutine de `viewModelScope`. Si l'utilisateur quitte l'app immédiatement après `stop()`, le scope est annulé avant que la coroutine termine. `onCleared()` protège le cas destruction mais pas le cas stop-then-destroy rapide.

**Correction mineure :** lancer `reportNow()` avec `NonCancellable` ou déplacer la responsabilité du flush à `onCleared()` uniquement.

---

### [MINEUR] `ProgressReporter.start()` termine silencieusement sur exception inattendue

**Localisation :** `progress/ProgressReporter.kt:18-29`

Si une exception non-cancellation survient dans la boucle (hors réseau, déjà géré par `report()`), la loop se termine sans retry. Les rapports de progression s'arrêtent jusqu'au prochain `load()`.

---

## Risques éventuels

- **API paths non encodés** : `/progress/$mediaType/$mediaId` — sans encoding si les IDs contiennent `/` ou `?`. Faible risque si les IDs sont alphanumériques (contrat backend), mais aucune garde explicite.
- **`ExoPlayer` exposé publiquement** : `val player: ExoPlayer` est public dans `PlayerViewModel`. Permet à n'importe quelle composante d'interagir directement avec le player hors ViewModel — acceptable pour un player simple mais peut compliquer les évolutions futures.

---

## Décision

Le scope du ticket est couvert. La sécurité et les critères d'acceptation sont satisfaits. Le problème de cohérence `SseClient` ↔ `CommandRepository` / test invalide est un point d'intégrité architecturale qui doit être résolu : un test qui valide une feature qui ne fonctionne pas en production ne peut pas être accepté tel quel.

## Actions demandées

1. **[REQUIS]** Corriger la cohérence entre `SseClient` et `CommandRepository` concernant le fallback polling (Option A ou B décrite ci-dessus) et mettre à jour `ReconnectBackoffTest` pour valider uniquement des comportements observables avec le vrai `SseClient`.
2. **[RECOMMANDÉ]** `selectTrack()` : utiliser un override ciblé par type plutôt que `clearOverrides()`.
3. **[OPTIONNEL]** Protéger le `reportNow()` de `stop()` avec `NonCancellable` ou documenter la limitation.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T056/reviews/implementation-review.md
- generated at: 2026-08-13T02:19:01Z

---

Now I have enough information to write the review. Let me produce the structured review.

---

# PR Review — T056: Android TV Companion Player

## Résumé

L'implémentation couvre l'ensemble du scope T056 : flux de pairing, réception de commandes SSE, lecture Media3, signalement de progression et contrôles de télécommande. La structure MVVM + Compose for TV est cohérente, la sécurité des credentials est solide, et les tests unitaires couvrent les chemins principaux. Un problème d'architecture modéré entre `SseClient` et `CommandRepository` rend le fallback polling dead code en production et invalide le test qui prétend le valider.

---

## Vérifications effectuées

- Lecture de tous les fichiers source de `apps/android-tv/`
- Lecture des 5 fichiers de tests
- Vérification de la concordance avec les 10 critères d'acceptation du ticket
- Analyse du flux de reconnexion SSE / fallback polling
- Inspection de la gestion sécurisée du token
- Vérification de `PlayerViewModel.onCleared()` / flush progress
- Analyse de `selectTrack()` et `clearOverrides()`

---

## Points validés

- **Pairing** : `PairingScreen` affiche le code 8 caractères + QR (ZXing), `PairingRepository` implémente la machine d'états `Idle → Approved | Expired`. Token stocké dans `EncryptedSharedPreferences` AES256-GCM / Android Keystore.
- **Sécurité credentials** : Token jamais loggué, isolation via `TokenStore`, révocation sur 401 via `onRevoked()` callback. ✅
- **Commandes SSE** : `SseClient.commandStream()` retente avec backoff exponentiel borné (`1s → 2s → 4s → ... → 60s`). Le parser `CommandParser` retourne null sur champ manquant, JSON malformé, ou id vide. ✅
- **Déduplication** : `CommandRepository` maintient un `synchronizedSet` d'ids acquittés + appel immédiat à `POST /devices/me/commands/{id}/ack`. ✅
- **Lecture Media3** : `MediaItemBuilder` construit les `MediaItem` avec DRM optionnel (UUID parsing isolé). `player.seekTo(command.startPositionMs)` honore la position de reprise. ✅
- **Pistes audio/sous-titres** : `onTracksChanged` mappe les `Tracks.Group` ExoPlayer vers `TrackInfo`, `selectTrack()` applique un `TrackSelectionOverride`. ✅
- **Progression** : `ProgressReporter` envoie `PUT /progress/{type}/{id}` toutes les 15s en lecture + `reportNow()` sur pause/stop. ✅
- **Flush final** : `onCleared()` utilise `runBlocking(NonCancellable) { withTimeout(2000L) { reportNow() } }` — correctement protégé contre l'annulation du scope. ✅
- **Erreurs de lecture** : `PlayerUiState.Error` + `ErrorOverlay` avec retry/back, sans crash. ✅
- **Écran home** : `HomeScreen` affiche nom de device, indicateur de connexion (Connected / Reconnecting / Revoked), dernier média joué. ✅
- **Tests** : 5 fichiers couvrant parsing, pairing, backoff, progression, MediaItem builder — aucun accès réseau réel requis. ✅

---

## Problèmes détectés

### [MODÉRÉ] Fallback polling dead code — test invalide (`CommandRepository` + `ReconnectBackoffTest`)

**Localisation :** `command/CommandRepository.kt:28-70`, `command/ReconnectBackoffTest.kt:55-72`

`SseClient.commandStream()` est un flow infini qui capture toutes les exceptions réseau en interne et les retente avec backoff (le `catch (e: Exception)` dans SseClient délaye puis continue le `while (currentCoroutineContext().isActive)`). Il ne propagea jamais une exception non-auth / non-cancellation au collecteur.

Conséquence : dans `CommandRepository.commands()`, le bloc `catch (e: Exception) { sseFailed++ }` ne peut jamais être atteint avec le vrai `SseClient`. Le compteur `sseFailed` reste à 0 en permanence — le mode polling est unreachable en production.

Le test `"after 3 SSE failures repository switches to polling"` contourne ce problème en mockant `commandStream()` pour lancer directement une `IOException`, ce qui est impossible avec l'implémentation réelle. Le test passe mais valide un comportement fictif.

**Options de correction :**

Option A — Propagation après N échecs (architecture cohérente) : faire terminer `SseClient.commandStream()` normalement (sans exception) après `MAX_ATTEMPT` tentatives consécutives. `CommandRepository` voit le flow se terminer, `sseFailed` n'est pas incrémenté mais le while boucle vers le fallback polling via un état interne. *Attention : nécessite de revoir la sémantique du reset `sseFailed = 0`.*

Option B — plus propre : supprimer le fallback polling de `CommandRepository` (SseClient gère déjà la reconnexion), et reformuler le test pour valider le comportement réel (backoff dans SseClient, déduplication dans CommandRepository). Le test `backoff sequence` et `capped at 60s` restent valides. Supprimer ou remplacer le test de polling fallback par un test vérifiant que les connexions SSE réussies réinitialisent le compteur.

---

### [MINEUR] `selectTrack()` efface toutes les overrides — audio et sous-titre ne peuvent pas coexister

**Localisation :** `player/PlayerViewModel.kt:152-158`

```kotlin
.buildUpon()
.clearOverrides()  // efface l'override audio si on sélectionne un sous-titre
.addOverride(...)
```

Sélectionner un sous-titre efface l'override audio explicite et vice-versa. Acceptable pour un compagnon minimaliste, mais peut dérouter l'utilisateur qui change de langue audio après avoir activé des sous-titres.

**Correction possible :** utiliser `setOverrideForType()` ciblant uniquement le type de piste concerné, ou maintenir deux overrides séparés (un par type).

---

### [MINEUR] `stop()` : progression reportée de façon async sans garantie de livraison

**Localisation :** `player/PlayerViewModel.kt:144-149`

```kotlin
fun stop() {
    viewModelScope.launch { progressReporter?.reportNow() }  // asynchrone
    reporterJob?.cancel()
    player.stop()
```

`reportNow()` est lancé dans un coroutine de `viewModelScope`. Si l'utilisateur quitte l'app immédiatement après `stop()`, le scope est annulé avant que la coroutine termine. `onCleared()` protège le cas destruction mais pas le cas stop-then-destroy rapide.

**Correction mineure :** lancer `reportNow()` avec `NonCancellable` ou déplacer la responsabilité du flush à `onCleared()` uniquement.

---

### [MINEUR] `ProgressReporter.start()` termine silencieusement sur exception inattendue

**Localisation :** `progress/ProgressReporter.kt:18-29`

Si une exception non-cancellation survient dans la boucle (hors réseau, déjà géré par `report()`), la loop se termine sans retry. Les rapports de progression s'arrêtent jusqu'au prochain `load()`.

---

## Risques éventuels

- **API paths non encodés** : `/progress/$mediaType/$mediaId` — sans encoding si les IDs contiennent `/` ou `?`. Faible risque si les IDs sont alphanumériques (contrat backend), mais aucune garde explicite.
- **`ExoPlayer` exposé publiquement** : `val player: ExoPlayer` est public dans `PlayerViewModel`. Permet à n'importe quelle composante d'interagir directement avec le player hors ViewModel — acceptable pour un player simple mais peut compliquer les évolutions futures.

---

## Décision

Le scope du ticket est couvert. La sécurité et les critères d'acceptation sont satisfaits. Le problème de cohérence `SseClient` ↔ `CommandRepository` / test invalide est un point d'intégrité architecturale qui doit être résolu : un test qui valide une feature qui ne fonctionne pas en production ne peut pas être accepté tel quel.

## Actions demandées

1. **[REQUIS]** Corriger la cohérence entre `SseClient` et `CommandRepository` concernant le fallback polling (Option A ou B décrite ci-dessus) et mettre à jour `ReconnectBackoffTest` pour valider uniquement des comportements observables avec le vrai `SseClient`.
2. **[RECOMMANDÉ]** `selectTrack()` : utiliser un override ciblé par type plutôt que `clearOverrides()`.
3. **[OPTIONNEL]** Protéger le `reportNow()` de `stop()` avec `NonCancellable` ou documenter la limitation.

IMPLEMENTATION_FIX_REQUIRED