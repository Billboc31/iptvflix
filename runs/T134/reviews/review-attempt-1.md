# PR Review — T134: Add Live TV mode to Android TV app with orange visual identity

## Résumé

L'implémentation couvre la totalité du scope T134 : mode TV/VOD switchable, écran LiveTvHome avec identité visuelle orange, chargement depuis l'API canonique `/channels`, états loading/error/empty, et focus D-pad. Le code est propre, la séparation des couches est respectée, et les VOD paths sont intacts. Un problème bloquant est identifié sur la couverture de test du ViewModel.

---

## Vérifications effectuées

- Lecture du plan (`runs/T134/plan.md`) et comparaison ligne à ligne avec l'implémentation
- Lecture de tous les fichiers source produits (12 fichiers)
- Comparaison du modèle `ChannelResponse` Kotlin avec `packages/api-contracts/src/channels.ts`
- Vérification des tests (3 fichiers) et de leur couverture réelle
- Vérification de `AppNavGraph.kt` pour les impacts sur la navigation existante
- Vérification que `TvColors.Accent` (rouge VOD) n'est pas modifié

---

## Points validés

**Architecture & séparation**
- `ChannelApi` → `ChannelRepository` → `LiveTvHomeViewModel` → `LiveTvHomeScreen` : couches proprement séparées
- Aucun accès DB direct depuis Android ; toutes les données viennent de `GET /channels`
- VOD : `HomeScreen`, `PlayerScreen`, `WhoIsWatchingScreen`, `PairingScreen` — aucune modification de comportement

**Conformité au contrat API**
- `ChannelResponse` Kotlin correspond exactement à `packages/api-contracts/src/channels.ts`
- `isFavorite: Boolean = false` gère correctement l'optionnel TypeScript `isFavorite?: boolean`
- `ignoreUnknownKeys = true` assure la compatibilité ascendante
- Aucun stream URL brut ni déduplication provider côté Android

**Identité visuelle**
- `TvColors.LiveTvAccent = Color(0xFFFF8C00)` ajouté ; `TvColors.Accent` (rouge, `0xFFE50914`) inchangé
- Orange appliqué à tous les états de focus, spinners, badges, titres dans `LiveTvHomeScreen`
- `ModeToggleBar` : "VOD" rouge, "TV" orange — D-pad only, aucun exit app involontaire

**États UI**
- Loading : spinner Canvas orange (remplacement correct de `CircularProgressIndicator`, matériau absent)
- Error : message + bouton "Réessayer" avec focus initial via `FocusRequester`
- Empty : texte centré quand les 3 sections sont vides
- Ready : sections "Récemment regardé" et "Favoris" masquées (pas juste vides) si la liste est vide

**EPG**
- `if (channel.epg?.now != null)` : le titre EPG s'affiche seulement si présent ; aucun placeholder inventé — conforme AC

**Navigation**
- `Screen.LiveTvHome` ajouté à l'enum `Screen`
- `BackHandler` dans `LiveTvHomeScreen` → `onBack()` → `Screen.Home` : retour correct sans quitter l'app
- La commande WebSocket `latestCommand` ne déclenche le Player que depuis `Screen.Home` — LiveTvHome est isolé correctement

**Gestion des erreurs par section**
- `ChannelRepository` utilise `runCatching` + `getOrDefault(emptyList())` par section
- Erreur réseau sur "Recently Watched" n'empêche pas "All Channels" de s'afficher
- Log.w explicite pour chaque section en échec — pas de silence total

**Tests existants**
- Aucun test VOD existant n'est modifié
- `ChannelApiParserTest` : 4 cas JSON couvrant full/no-EPG/no-logo/minimal — correct

---

## Problèmes détectés

### [BLOQUANT] `LiveTvHomeViewModelTest` ne teste pas le ViewModel

**Fichier** : `app/src/test/kotlin/com/iptvflix/androidtv/livetv/LiveTvHomeViewModelTest.kt`

Le test n'instancie jamais `LiveTvHomeViewModel`. `simulateLoad()` est une simple construction directe de `LiveTvHomeState.Ready(...)` :

```kotlin
private suspend fun simulateLoad(...): LiveTvHomeState = LiveTvHomeState.Ready(
    recent = recent,
    favorites = favorites,
    all = all,
)
```

Ce helper contourne complètement :
- Les coroutines parallèles (`async { repo.recentChannels() }`)
- La transition `Loading → Ready`
- Le bloc `try/catch` du ViewModel (chemin `Error`)
- La fonction `retry()`
- L'injection du repository (`getApplication<App>().channelRepository`)

Le docstring indique "exercising the same suspend logic used by the ViewModel" — c'est inexact ; aucune logique ViewModel n'est exercée.

**Le plan spécifiait** : "Mock `ChannelRepository`; test: All three sections loading → `Loading` state; All three resolve → `Ready` state..."

**Correction attendue** : Extraire `ChannelRepository` en paramètre constructeur de `LiveTvHomeViewModel` pour permettre un vrai test unitaire (sans `AndroidViewModel` / `Application`), ou utiliser un test de type coroutine avec `TestCoroutineDispatcher`. Le test doit au minimum vérifier que `load()` produit `Loading` puis `Ready`, et que `retry()` relance le chargement.

---

### [MINEUR] `ChannelListResponse` est du code mort

**Fichier** : `livetv/ChannelModels.kt`, ligne 31-34

```kotlin
@Serializable
data class ChannelListResponse(
    val channels: List<ChannelResponse>,
)
```

Ce type est défini mais jamais utilisé. `ChannelApi.getChannels()` décode directement en `List<ChannelResponse>`, ce qui est cohérent avec le contrat API (pas de wrapper `{ channels: [...] }` dans `channels.ts`). La classe doit être supprimée.

---

### [MINEUR] Clé `pointerInput` instable sur le bouton Retry

**Fichier** : `LiveTvHomeScreen.kt`, ligne 119

```kotlin
modifier = Modifier.pointerInput(onRetry) { detectTapGestures(onTap = { onRetry() }) }
```

La clé `onRetry` est une lambda — elle change à chaque recomposition, ce qui recréé le gestionnaire de gestes inutilement. La clé devrait être `Unit`.

---

### [OBSERVATION] EPG `next` jamais rendu

Le champ `epg.next` est désérialisé correctement mais n'est affiché nulle part dans l'UI. Le ticket ne l'impose pas explicitement (`EPG-ready current-program information where the API provides it`), mais `next` est disponible dans le modèle. À considérer pour un ticket suivant.

---

### [OBSERVATION] `isSystemInDarkTheme()` dans TvTheme sans effet

**Fichier** : `TvTheme.kt`, ligne 37-38

```kotlin
colorScheme = if (isSystemInDarkTheme()) TvDarkColors else TvDarkColors,
```

Les deux branches retournent `TvDarkColors`. Code vestige sans impact fonctionnel mais légèrement trompeur.

---

## Risques éventuels

- **Compatibilité API** : si le backend retourne à l'avenir `{ "channels": [...] }` plutôt qu'un array JSON brut, `json.decodeFromString<List<ChannelResponse>>(body)` échouera avec une `SerializationException` silencieusement swallowed par `ChannelRepository.runCatching`. Le comportement visible serait "Aucune chaîne disponible" sans indication de cause. Aucun risque immédiat mais à documenter.
- **`categories` non défini côté API** : Kotlin default `emptyList()` masque silencieusement une régression API. Acceptable pour l'instant.

---

## Décision

- REQUEST_CHANGES

Un point bloquant : `LiveTvHomeViewModelTest` ne teste pas le ViewModel et donne une fausse confiance sur la couverture de l'AC "tests for canonical channel rendering". Le reste de l'implémentation est de bonne qualité et conforme au plan.

## Actions demandées

1. **[BLOQUANT]** Refactorer `LiveTvHomeViewModel` pour recevoir `ChannelRepository` en paramètre constructeur (via `ViewModelProvider.Factory`). Réécrire `LiveTvHomeViewModelTest` pour tester réellement les transitions d'état avec un repository fakable, en utilisant `runTest` + `TestScope`.

2. **[MINEUR]** Supprimer la classe `ChannelListResponse` non utilisée de `ChannelModels.kt`.

3. **[MINEUR]** Corriger la clé `pointerInput(onRetry)` → `pointerInput(Unit)` dans `LiveTvHomeScreen.kt`.
