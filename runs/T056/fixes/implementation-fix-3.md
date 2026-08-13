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
