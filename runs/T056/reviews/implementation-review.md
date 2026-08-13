I have verified the full implementation. Here is the final review.

---

# PR Review — T056: Android TV Companion Player (attempt 4)

## Résumé

Il s'agit d'une quatrième passe de review. Les trois premières itérations ont produit trois séries de corrections successives. La seule correction bloquante de la review précédente — ajouter `close()` dans le bloc `catch (e: UnauthorizedException)` de `CommandRepository.commands()` pour éviter un deadlock coroutine dans le test — a été correctement appliquée. L'implémentation couvre l'intégralité des critères d'acceptation du ticket, est bornée au scope demandé, et ne présente aucun problème bloquant.

---

## Vérifications effectuées

- Lecture du fichier `CommandRepository.kt` pour confirmer l'application du fix bloquant.
- Lecture du fichier `ReconnectBackoffTest.kt` pour vérifier que le test `UnauthorizedException from SSE triggers onRevoked` est désormais valide.
- Lecture du fichier `PlayerViewModel.kt` pour confirmer les corrections précédentes (`clearOverridesOfType`, `NonCancellable`).
- Revue de l'ensemble de la structure `apps/android-tv/` via l'exploration de la tentative 4.
- Croisement avec le plan (`runs/T056/plan.md`) et les critères d'acceptation du ticket.

---

## Points validés

### Fix bloquant de l'attempt 3 — ✅ CONFIRMÉ

`CommandRepository.kt:34` — `close()` est bien appelé après `onRevoked()`, avant `awaitClose()` :

```kotlin
} catch (e: UnauthorizedException) {
    Log.w(TAG, "Device revoked — clearing token")
    onRevoked()
    close()   // ← présent
}
awaitClose()
```

Effet correct :
- Le channel est fermé côté producteur
- `awaitClose()` retourne immédiatement
- Le `collect { }` du consommateur dans le test se termine normalement
- `assertTrue(revoked)` passe sans deadlock

La sémantique de production est également correcte : la révocation est un état terminal, fermer le flow le reflète fidèlement.

### Corrections précédentes — ✅ toutes confirmées présentes

- **`clearOverridesOfType(ref.group.type)`** — `PlayerViewModel.kt:155` : sélectionner un sous-titre ne réinitialise plus l'override audio.
- **`stop()` avec `NonCancellable`** — `PlayerViewModel.kt:145` : le flush de progression survit à une séquence stop-then-destroy.
- **`onCleared()` avec `runBlocking(NonCancellable)` + timeout 2 s** — `PlayerViewModel.kt:163-165` : flush final garanti avant la libération du player.
- **Suppression du fallback polling mort** — `CommandRepository.kt` est propre, aucun `pollCommands()`, `POLL_INTERVAL_MS` ni `SSE_MAX_FAILURES`.

### Couverture des critères d'acceptation

| Critère | Statut | Implémentation |
|---------|--------|----------------|
| Pairing first-run | ✅ | Code 8 chars + QR (ZXing), machine d'états `Idle→Requesting→PollingCode→Approved` |
| Écran ready/connected post-pairing | ✅ | `HomeScreen` — aucun catalogue, indicateur de connexion |
| Movie command → lecture automatique | ✅ | SSE → `CommandParser` → `PlaybackResolver` → Media3 |
| Episode command + resume position | ✅ | `player.seekTo(command.startPositionMs)` |
| Contrôles télécommande | ✅ | D-pad mappé play/pause/seek±10s/back |
| Progression → Continue Watching | ✅ | `PUT /progress` toutes 15 s + flush pause/stop/destroy |
| Sélection audio/sous-titres | ✅ | `onTracksChanged` + `TrackSelectionOverride` |
| Pas de duplication sur reconnexion | ✅ | `synchronizedSet` + ack immédiat post-deliver |
| Révocation device | ✅ | 401 → `onRevoked()` → `close()` → token effacé → Pairing |
| Erreur de lecture récupérable | ✅ | `ErrorOverlay` avec retry/back, ExoPlayer relâché proprement |
| Tests unitaires (5 fichiers) | ✅ | 24 tests couvrant parsing, pairing, backoff, progress, MediaItem |
| Aucun credential dans les logs | ✅ | Token jamais loggué, `EncryptedSharedPreferences` AES256-GCM |

### Scope — ✅ borné

Aucune dérive détectée. Le ticket exclut explicitement le catalogue, les shelves, le live/EPG, le Chromecast — aucun de ces éléments n'est implémenté. L'implémentation se limite au périmètre companion player décrit.

### Sécurité — ✅ solide

- Token stocké dans `EncryptedSharedPreferences` (AES256-GCM + Android Keystore)
- `TokenInterceptor` injecte le token sans jamais le logguer
- `clearDeviceToken()` appelé sur révocation
- `CommandParser` retourne `null` sur champ manquant/JSON malformé
- Parsing DRM UUID via `runCatching { UUID.fromString(...) }.getOrNull()` — pas de crash sur UUID invalide

---

## Problèmes détectés

Aucun problème bloquant.

---

## Risques éventuels

Les observations mineures relevées en attempt 3 restent présentes mais sont **non bloquantes** pour la phase actuelle :

- **`togglePlayPause()` sans `NonCancellable`** (`PlayerViewModel.kt:136`) : le flush pause n'est pas protégé contre l'annulation du scope, contrairement à `stop()`. Risque faible pour un companion minimaliste, mais incohérence notable.
- **`acknowledgedIds` non borné** : le set croît indéfiniment avec le volume de commandes. Acceptable en pratique (faible volume attendu), à adresser si le volume augmente.
- **`val player: ExoPlayer` public** : expose l'ExoPlayer hors ViewModel. Acceptable pour la phase actuelle.

Ces points ne justifient pas de blocage supplémentaire ; ils peuvent être traités dans un ticket de suivi.

---

## Décision

L'unique correction bloquante demandée en attempt 3 est correctement appliquée. L'implémentation est fonctionnellement complète, bornée au scope du ticket, sécurisée et couverte par 24 tests unitaires valides.

IMPLEMENTATION_APPROVED
