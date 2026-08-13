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

All three fixes are applied correctly. Here's a summary of what changed:

---

## Changes applied

**3 files modified:**

| File | Fix |
|---|---|
| `command/CommandRepository.kt` | Removed fallback polling entirely. `commands()` now simply collects from `sseClient.commandStream()` with deduplication + revocation handling. Removed `POLL_INTERVAL_MS`, `SSE_MAX_FAILURES`, `pollCommands()`, and 4 unused imports (`delay`, `Json`, `jsonArray`, `jsonObject`). |
| `command/ReconnectBackoffTest.kt` | Replaced the invalid `"after 3 SSE failures repository switches to polling"` test with `"UnauthorizedException from SSE triggers onRevoked"` — tests real behavior observable with the actual `SseClient`. Also fixed `commandStream()` mock in the duplicate test to use `every` instead of `coEvery` (it's not a suspend function). |
| `player/PlayerViewModel.kt` | `selectTrack()`: `clearOverrides()` → `clearOverridesOfType(ref.group.type)` so selecting a subtitle track no longer wipes the audio override. `stop()`: added `NonCancellable` context to the `reportNow()` launch so the progress flush survives rapid stop-then-destroy sequences. |

---

## Review

---

# PR Review — T056: Android TV Companion Player (attempt 3)

## Résumé

Les trois corrections demandées lors de la review précédente sont correctement appliquées. La déduplication, la sélection de piste et le flush de progression sont solides. Un seul problème bloquant subsiste : le test de remplacement `UnauthorizedException from SSE triggers onRevoked` introduit un deadlock coroutine qui le rend invalide — exactement le même type d'invalidité que le test qu'il remplace.

---

## Vérification des corrections demandées

### [REQUIS] Suppression du fallback polling mort — ✅ APPLIQUÉ

`CommandRepository.kt` est propre : plus de `POLL_INTERVAL_MS`, `SSE_MAX_FAILURES`, `pollCommands()`, ni des 4 imports inutilisés. `commands()` collecte uniquement depuis `sseClient.commandStream()` avec déduplication et gestion 401.

### [RECOMMANDÉ] `selectTrack()` override ciblé — ✅ APPLIQUÉ

`PlayerViewModel.kt:155` utilise bien `clearOverridesOfType(ref.group.type)` au lieu de `clearOverrides()`. Sélectionner un sous-titre ne réinitialise plus l'override audio.

### [OPTIONNEL] `stop()` flush NonCancellable — ✅ APPLIQUÉ

`PlayerViewModel.kt:145` : `viewModelScope.launch(NonCancellable) { progressReporter?.reportNow() }`. Le flush de progression survit à une séquence rapide stop-then-destroy.

---

## Problème bloquant détecté

### [BLOQUANT] `ReconnectBackoffTest::UnauthorizedException from SSE triggers onRevoked` — deadlock coroutine

**Localisation :** `ReconnectBackoffTest.kt:53-66`, `CommandRepository.kt:20-36`

**Mécanisme du deadlock :**

Le test exécute :
```kotlin
runCatching { repo.commands().collect { } }
assertTrue(revoked)
```

Dans `commands()` (implémenté avec `callbackFlow`) :
```kotlin
fun commands(): Flow<PlaybackCommand> = callbackFlow {
    try {
        sseClient.commandStream().collect { ... }   // throws UnauthorizedException (mock)
    } catch (e: UnauthorizedException) {
        onRevoked()                                  // revoked = true ✓
    }
    awaitClose()                                     // ← suspend indéfini
}
```

Déroulement :
1. `commandStream()` mocké pour lancer `UnauthorizedException` à l'appel
2. `catch` exécute `onRevoked()` → `revoked = true` ✓
3. Le code atteint `awaitClose()` — suspend le coroutine producteur jusqu'à ce que le channel soit fermé ou annulé
4. Le consommateur (`collect { }`) attend lui aussi des éléments ou la fermeture du channel
5. Aucun ne peut progresser → deadlock

Dans `runTest`, aucun `delay()` ou `advanceTimeBy()` ne peut débloquer un `suspendCancellableCoroutine`. Le test timeout ou échoue avec des coroutines non terminées — exactement le même problème d'invalidité que le test de polling qu'il remplace.

**Correction recommandée (2 lignes, production + test) :**

Dans `CommandRepository.kt`, ajouter `close()` dans le catch de révocation :
```kotlin
} catch (e: UnauthorizedException) {
    Log.w(TAG, "Device revoked — clearing token")
    onRevoked()
    close()   // termine le flow de façon propre — révocation est un état terminal
}
awaitClose()
```

Effet :
- `close()` ferme le channel côté producteur
- `awaitClose()` retourne immédiatement (channel déjà fermé)
- Le `collect { }` du consommateur se termine normalement
- Le test progresse jusqu'à `assertTrue(revoked)` → passe

La sémantique est aussi correcte en production : après révocation, aucune nouvelle commande ne peut arriver — fermer le flow le reflète fidèlement.

**Alternative (test seulement, moins préférable) :** réécrire le test avec le pattern `launch { } + cancel()` utilisé dans `ProgressReporterTest` :
```kotlin
val job = launch { runCatching { repo.commands().collect { } } }
testScheduler.advanceUntilIdle()
assertTrue(revoked)
job.cancel()
```

---

## Observations mineures (non bloquantes)

- **`togglePlayPause()` : `reportNow()` sans `NonCancellable`** (`PlayerViewModel.kt:136`). `stop()` a été protégé mais pas `togglePlayPause()`. Risque faible pour un compagnon minimaliste, mais l'incohérence est notable.
- **`acknowledgedIds` non borné** : set qui grandit à chaque commande sans éviction. Acceptable en pratique (faible volume), mentionnable en code review manuel.
- **`val player: ExoPlayer` public** : expose directement l'ExoPlayer hors ViewModel. Acceptable pour la phase actuelle.

---

## Couverture des critères d'acceptation

| Critère | Statut |
|---------|--------|
| Pairing first-run | ✅ Code 8 chars + QR, token chiffré |
| Écran ready/connected post-pairing | ✅ HomeScreen avec indicateur de statut |
| Movie playback sur commande | ✅ SSE → Parser → Resolver → Media3 |
| Episode + position de reprise | ✅ `seekTo(command.startPositionMs)` |
| Contrôles télécommande | ✅ D-pad mappé play/pause/seek/back |
| Progression vers Continue Watching | ✅ PUT /progress toutes les 15s + flush |
| Sélection audio/sous-titres | ✅ `onTracksChanged` + `TrackSelectionOverride` |
| Pas de duplication sur reconnexion | ✅ `synchronizedSet` + ack immédiat |
| Révocation device | ✅ 401 → `onRevoked()` → retour Pairing |
| Erreur de lecture récupérable | ✅ `ErrorOverlay` sans crash |

Tous les critères d'acceptation sont couverts par l'implémentation. La sécurité (token chiffré, aucun log de credential) est solide.

---

## Action demandée

**[REQUIS]** Ajouter `close()` dans le bloc `catch (e: UnauthorizedException)` de `CommandRepository.commands()` (avant `awaitClose()`). Cette modification corrige simultanément le deadlock du test et le comportement de production (flow terminé proprement sur révocation).

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T056/reviews/implementation-review.md
- generated at: 2026-08-13T02:27:44Z

---

---

# PR Review — T056: Android TV Companion Player (attempt 3)

## Résumé

Les trois corrections demandées lors de la review précédente sont correctement appliquées. La déduplication, la sélection de piste et le flush de progression sont solides. Un seul problème bloquant subsiste : le test de remplacement `UnauthorizedException from SSE triggers onRevoked` introduit un deadlock coroutine qui le rend invalide — exactement le même type d'invalidité que le test qu'il remplace.

---

## Vérification des corrections demandées

### [REQUIS] Suppression du fallback polling mort — ✅ APPLIQUÉ

`CommandRepository.kt` est propre : plus de `POLL_INTERVAL_MS`, `SSE_MAX_FAILURES`, `pollCommands()`, ni des 4 imports inutilisés. `commands()` collecte uniquement depuis `sseClient.commandStream()` avec déduplication et gestion 401.

### [RECOMMANDÉ] `selectTrack()` override ciblé — ✅ APPLIQUÉ

`PlayerViewModel.kt:155` utilise bien `clearOverridesOfType(ref.group.type)` au lieu de `clearOverrides()`. Sélectionner un sous-titre ne réinitialise plus l'override audio.

### [OPTIONNEL] `stop()` flush NonCancellable — ✅ APPLIQUÉ

`PlayerViewModel.kt:145` : `viewModelScope.launch(NonCancellable) { progressReporter?.reportNow() }`. Le flush de progression survit à une séquence rapide stop-then-destroy.

---

## Problème bloquant détecté

### [BLOQUANT] `ReconnectBackoffTest::UnauthorizedException from SSE triggers onRevoked` — deadlock coroutine

**Localisation :** `ReconnectBackoffTest.kt:53-66`, `CommandRepository.kt:20-36`

**Mécanisme du deadlock :**

Le test exécute :
```kotlin
runCatching { repo.commands().collect { } }
assertTrue(revoked)
```

Dans `commands()` (implémenté avec `callbackFlow`) :
```kotlin
fun commands(): Flow<PlaybackCommand> = callbackFlow {
    try {
        sseClient.commandStream().collect { ... }   // throws UnauthorizedException (mock)
    } catch (e: UnauthorizedException) {
        onRevoked()                                  // revoked = true ✓
    }
    awaitClose()                                     // ← suspend indéfini
}
```

Déroulement :
1. `commandStream()` mocké pour lancer `UnauthorizedException` à l'appel
2. `catch` exécute `onRevoked()` → `revoked = true` ✓
3. Le code atteint `awaitClose()` — suspend le coroutine producteur jusqu'à ce que le channel soit fermé ou annulé
4. Le consommateur (`collect { }`) attend lui aussi des éléments ou la fermeture du channel
5. Aucun ne peut progresser → deadlock

Dans `runTest`, aucun `delay()` ou `advanceTimeBy()` ne peut débloquer un `suspendCancellableCoroutine`. Le test timeout ou échoue avec des coroutines non terminées — exactement le même problème d'invalidité que le test de polling qu'il remplace.

**Correction recommandée (2 lignes, production + test) :**

Dans `CommandRepository.kt`, ajouter `close()` dans le catch de révocation :
```kotlin
} catch (e: UnauthorizedException) {
    Log.w(TAG, "Device revoked — clearing token")
    onRevoked()
    close()   // termine le flow de façon propre — révocation est un état terminal
}
awaitClose()
```

Effet :
- `close()` ferme le channel côté producteur
- `awaitClose()` retourne immédiatement (channel déjà fermé)
- Le `collect { }` du consommateur se termine normalement
- Le test progresse jusqu'à `assertTrue(revoked)` → passe

La sémantique est aussi correcte en production : après révocation, aucune nouvelle commande ne peut arriver — fermer le flow le reflète fidèlement.

**Alternative (test seulement, moins préférable) :** réécrire le test avec le pattern `launch { } + cancel()` utilisé dans `ProgressReporterTest` :
```kotlin
val job = launch { runCatching { repo.commands().collect { } } }
testScheduler.advanceUntilIdle()
assertTrue(revoked)
job.cancel()
```

---

## Observations mineures (non bloquantes)

- **`togglePlayPause()` : `reportNow()` sans `NonCancellable`** (`PlayerViewModel.kt:136`). `stop()` a été protégé mais pas `togglePlayPause()`. Risque faible pour un compagnon minimaliste, mais l'incohérence est notable.
- **`acknowledgedIds` non borné** : set qui grandit à chaque commande sans éviction. Acceptable en pratique (faible volume), mentionnable en code review manuel.
- **`val player: ExoPlayer` public** : expose directement l'ExoPlayer hors ViewModel. Acceptable pour la phase actuelle.

---

## Couverture des critères d'acceptation

| Critère | Statut |
|---------|--------|
| Pairing first-run | ✅ Code 8 chars + QR, token chiffré |
| Écran ready/connected post-pairing | ✅ HomeScreen avec indicateur de statut |
| Movie playback sur commande | ✅ SSE → Parser → Resolver → Media3 |
| Episode + position de reprise | ✅ `seekTo(command.startPositionMs)` |
| Contrôles télécommande | ✅ D-pad mappé play/pause/seek/back |
| Progression vers Continue Watching | ✅ PUT /progress toutes les 15s + flush |
| Sélection audio/sous-titres | ✅ `onTracksChanged` + `TrackSelectionOverride` |
| Pas de duplication sur reconnexion | ✅ `synchronizedSet` + ack immédiat |
| Révocation device | ✅ 401 → `onRevoked()` → retour Pairing |
| Erreur de lecture récupérable | ✅ `ErrorOverlay` sans crash |

Tous les critères d'acceptation sont couverts par l'implémentation. La sécurité (token chiffré, aucun log de credential) est solide.

---

## Action demandée

**[REQUIS]** Ajouter `close()` dans le bloc `catch (e: UnauthorizedException)` de `CommandRepository.commands()` (avant `awaitClose()`). Cette modification corrige simultanément le deadlock du test et le comportement de production (flow terminé proprement sur révocation).

IMPLEMENTATION_FIX_REQUIRED