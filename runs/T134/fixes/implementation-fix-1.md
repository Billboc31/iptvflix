# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T134/reviews/implementation-review.md
- generated at: 2026-08-27T08:13:09Z

---

---

# PR Review — T134: Add Live TV mode to Android TV app with orange visual identity

## Résumé

L'implémentation couvre le scope T134 de façon satisfaisante : mode TV/VOD switchable, écran LiveTvHome avec identité visuelle orange, chargement depuis l'API canonique `/channels`, états loading/error/empty, focus D-pad, et aucune régression VOD. Un problème bloquant est détecté sur la couverture de test du ViewModel.

---

## Vérifications effectuées

- Plan `runs/T134/plan.md` comparé ligne à ligne à l'implémentation
- Tous les fichiers source (12 fichiers) lus directement
- `ChannelResponse` Kotlin comparé à `packages/api-contracts/src/channels.ts`
- 3 fichiers de test analysés en détail
- `AppNavGraph.kt` et `HomeScreen.kt` vérifiés pour impacts sur la navigation existante

---

## Points validés

- Architecture propre : `ChannelApi → ChannelRepository → ViewModel → Screen`, sans couplage VOD
- Modèle `ChannelResponse` conforme au contrat TypeScript (tous les champs, optionnels, défauts)
- `TvColors.LiveTvAccent = 0xFFFF8C00` ajouté ; `TvColors.Accent` (rouge VOD) inchangé
- Orange systématique dans LiveTvHome : focus, spinner, badges, titre
- `ModeToggleBar` dans HomeScreen : "VOD" rouge / "TV" orange, navigable D-pad, pas d'exit involontaire
- EPG affiché seulement si présent (`epg?.now != null`) — aucun placeholder inventé
- Sections "Récemment regardé" et "Favoris" masquées (pas vides) quand `emptyList()`
- `BackHandler` → `Screen.Home` sans quitter l'app
- Gestion d'erreur par section via `runCatching` — une section défaillante ne bloque pas les autres
- `ChannelApiParserTest` : 4 cas JSON corrects (full, no-EPG, no-logo, minimal)
- `ModeSwitchTest` : transitions VOD↔TV state-machine correctes
- Aucun test VOD existant modifié

---

## Problèmes détectés

### [BLOQUANT] `LiveTvHomeViewModelTest` ne teste pas le ViewModel

Le test n'instancie jamais `LiveTvHomeViewModel`. La fonction `simulateLoad()` est une simple construction directe de `LiveTvHomeState.Ready(...)` :

```kotlin
private suspend fun simulateLoad(...): LiveTvHomeState = LiveTvHomeState.Ready(
    recent = recent, favorites = favorites, all = all,
)
```

Aucune logique ViewModel n'est exercée : pas de coroutines parallèles, pas de transition `Loading → Ready`, pas de bloc `try/catch`, pas de `retry()`. Le docstring "exercising the same suspend logic used by the ViewModel" est inexact.

Le plan spécifiait "Mock `ChannelRepository`; test all three sections loading → `Loading` state; All three resolve → `Ready` state...". Ces cas ne sont pas couverts.

**Correction** : Extraire `ChannelRepository` en paramètre constructeur de `LiveTvHomeViewModel` (via `ViewModelProvider.Factory`) pour permettre un vrai test unitaire avec un repository fakeable. Réécrire `LiveTvHomeViewModelTest` pour tester les vraies transitions d'état avec `runTest` + `TestScope`.

### [MINEUR] `ChannelListResponse` est du code mort

Définie dans `ChannelModels.kt` mais jamais référencée — `ChannelApi` décode directement en `List<ChannelResponse>`, ce qui est correct. La classe doit être supprimée.

### [MINEUR] Clé `pointerInput` instable sur le bouton Retry

`pointerInput(onRetry) { ... }` — la lambda change à chaque recomposition, recréant inutilement le gestionnaire de gestes. Corriger en `pointerInput(Unit) { ... }`.

---

## Risques éventuels

- Si le backend retourne à l'avenir `{ "channels": [...] }` plutôt qu'un JSON array, la `SerializationException` sera swallowed silencieusement par `runCatching` et l'écran affichera "Aucune chaîne disponible" sans log d'erreur clair.

---

## Décision

- REQUEST_CHANGES

Le point bloquant (`LiveTvHomeViewModelTest` creux) doit être corrigé avant approbation. Le reste de l'implémentation est de bonne qualité et conforme au plan et au ticket.

---

IMPLEMENTATION_FIX_REQUIRED
