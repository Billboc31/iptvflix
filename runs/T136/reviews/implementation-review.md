I have everything I need. Here is the full review.

---

# PR Review — T136: Android TV Live Channel Zapping

## Résumé

L'implémentation couvre l'ensemble du scope du ticket : zapping via DPAD_UP/DOWN et KEYCODE_CHANNEL_UP/DOWN, HUD orange auto-dismiss, debounce last-key-wins, récupération après échec de lecture, et coexistence avec l'overlay channel selector. L'architecture est propre (`ChannelZapper` entièrement découplé du ViewModel et testable indépendamment), et les 12 tests de `ChannelZappingTest.kt` couvrent tous les cas limites de la logique de zapping.

Cependant, le plan exige explicitement un test pour le **guard overlay-open** — c'est-à-dire la vérification que DPAD_UP/DOWN et CHANNEL_UP/DOWN n'exécutent pas de zap quand le sélecteur de chaînes est ouvert. Ce test est absent, alors qu'il figure comme critère d'acceptance dans le ticket ET dans le plan.

---

## Vérifications effectuées

- Lecture complète de `ChannelZapper.kt`, `ZapChannelHud.kt`, `ChannelKeyEventBus.kt`
- Lecture des 226 lignes de `ChannelZappingTest.kt`
- Inspection des lignes clés de `PlayerScreen.kt` (247–335, 480–500)
- Vérification de la logique de guard overlay dans `onKeyEvent` et dans le `LaunchedEffect` CHANNEL key
- Croisement du plan `runs/T136/plan.md` avec l'implémentation effective
- Revue de la couverture de test (38 nouveaux tests répartis sur 6 fichiers)

---

## Points validés

**Architecture et qualité**
- `ChannelZapper` est entièrement indépendant de Compose et du ViewModel : bonne séparation des responsabilités, testable en isolation. ✓
- `ChannelKeyEventBus` (SharedFlow, capacité 8, replay 0) est minimal et adapté au contexte TV. ✓
- La lecture de `isChannelSelectorOpen` dans le `LaunchedEffect` accède chaque fois à la valeur courante du `MutableState<Boolean>` via le delegate `by` — pas de capture par valeur, comportement correct. ✓

**Logique de guard overlay**
- Dans `onKeyEvent` (ligne 279) : quand `isChannelSelectorOpen == true`, le handler retourne `true` immédiatement — tous les events D-pad sont consommés sans atteindre la branche zapping. ✓
- Dans le `LaunchedEffect` CHANNEL key (ligne 492) : `if (!isChannelSelectorOpen)` précède tout appel `vm.zapNext()`/`zapPrevious()`. ✓
- La propriété "input ownership" du ticket est garantie par le code : une seule entité (overlay ou player) reçoit les events à tout instant. ✓

**Comportement D-pad**
- DPAD_UP → `zapPrevious()`, DPAD_DOWN → `zapNext()` (sémantique liste, navigation naturelle). ✓
- CHANNEL_UP → `zapNext()`, CHANNEL_DOWN → `zapPrevious()` (convention TV classique). ✓
- L'asymétrie intentionnelle entre D-pad et CHANNEL keys est documentée dans les KDocs de `ChannelZapper`. ✓

**Debounce et gestion des press rapides**
- `enqueueZap` : HUD mis à jour immédiatement, job précédent cancelé, nouveau job avec `delay(150L)`. Last-key-wins correct. ✓
- Test `rapid zapNext calls result in exactly one switchChannel call` vérifie ce comportement. ✓

**Récupération après échec**
- `notifyPlaybackError()` → `zapIndex = lastGoodIndex`. Les zaps suivants repartent d'une position valide. ✓
- Test `failed playback reverts zapIndex to last good channel` vérifie ce comportement. ✓

**Non-régression VOD**
- Branche D-pad zapping gardée par `command?.mediaType.equals("channel", ignoreCase = true)` (ligne 317). ✓
- LaunchedEffect CHANNEL key retourne early si `mediaType != "channel"` (ligne 490). ✓

**HUD**
- `ZapChannelHud` : auto-dismiss 3s via `LaunchedEffect(channel.id)`, pas d'EPG fictif, accent orange `#FF8C00`, correctement conditionnel sur la présence de `logoUrl` et `epg?.now?.title`. ✓

---

## Problèmes détectés

### [BLOQUANT] Test overlay-open guard absent

Le plan (`runs/T136/plan.md`, ligne 61) exige explicitement :

> "Overlay-open guard: simulate overlay open — assert `zapNext()`/`zapPrevious()` are not called from `PlayerScreen` key events when `isChannelSelectorOpen == true`."

Le ticket (acceptance criteria) exige aussi :

> "Overlay-open UP/DOWN navigation does not accidentally trigger direct zapping."
> "Add Android input/player tests covering D-pad, channel keys, **overlay ownership**..."

Aucun test de cette nature n'existe dans `ChannelZappingTest.kt` ni dans les autres fichiers de test. La logique elle-même est correcte, mais le critère d'acceptance n'est pas satisfait sans test automatisé.

**Note d'implémentation :** tester ce guard nécessite de simuler l'état `isChannelSelectorOpen` qui est du Compose state dans `PlayerScreen`. Deux approches possibles :

1. **Test Compose UI (recommandé)** : utiliser `createComposeRule()` avec un test instrumenté ou Robolectric+Compose pour envoyer des key events à `PlayerScreen` avec l'overlay ouvert et vérifier que `vm.zapNext()` n'est pas appelé.

2. **Extraction de la logique** : extraire le guard CHANNEL key en une fonction pure `fun shouldZap(isOverlayOpen: Boolean, mediaType: String?): Boolean` testable en isolation avec un test unitaire standard.

---

### [Observation] Race théorique `initZapContext` (IO) vs `enqueueZap` (Main)

`initZapContext` est lancé sur `Dispatchers.IO` (via `viewModelScope.launch(Dispatchers.IO)`). Il écrit sur `zapChannels`, `zapIndex`, `lastGoodIndex` — des champs `var` sans synchronisation. `enqueueZap` les lit/écrit depuis le Main thread.

En pratique, le guard `if (channels.isEmpty()) return` dans `enqueueZap` protège la fenêtre critique (l'utilisateur ne peut pas zapper tant que la liste n'est pas chargée). La seule fenêtre dangereuse — entre l'assignation de `zapChannels` et celle de `zapIndex` — ne contient aucun point de suspension, donc le risque est infime. Non bloquant, mais à surveiller si `initZapContext` est refactorisé.

---

### [Observation] `notifyPlaybackSuccess()` pendant un zap rapide

Si ExoPlayer émet `STATE_READY` pour une chaîne précédente pendant une séquence de zap rapide, `lastGoodIndex` pourrait être ancré sur un index en cours de transition. Conséquence : la récupération après erreur repart d'une position légèrement décalée. Probabilité très faible (fenêtre < 150ms, STATE_READY arrivant après le debounce). Non bloquant.

---

## Risques éventuels

- Absence de test overlay guard : risque de régression silencieuse si la logique de `PlayerScreen.onKeyEvent` est refactorisée ultérieurement.
- `ChannelZapper` utilise une liste en cache immutable pour toute la session. Si l'API ajoute/supprime des chaînes, l'utilisateur ne le verra qu'après redémarrage de l'app. Comportement documenté et acceptable pour une session TV longue durée.

---

## Décision

L'implémentation est fonctionnellement correcte et de bonne qualité. Elle satisfait tous les critères d'acceptance du ticket à l'exception d'un : le test de la propriété d'ownership d'input (overlay-open guard). Ce test est explicitement requis dans le plan et le ticket.

**Action requise :** Ajouter au moins un test automatisé vérifiant que DPAD_UP/DOWN n'exécute pas de zap lorsque le channel selector est ouvert. Un test Compose UI ou une extraction de la logique en fonction testable sont les deux voies acceptables.

## Actions demandées

1. Ajouter un test pour le guard overlay-open (D-pad + CHANNEL keys) en utilisant soit un test Compose UI (`createComposeRule`), soit en extrayant la logique en une fonction pure testable.
2. (Optionnel mais bienvenu) Documenter dans un commentaire de code que CHANNEL_UP/DOWN sont scopés au mode plein écran uniquement, pour la prochaine personne qui touchera `PlayerScreen`.

IMPLEMENTATION_FIX_REQUIRED
