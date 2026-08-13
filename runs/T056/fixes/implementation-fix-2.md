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
