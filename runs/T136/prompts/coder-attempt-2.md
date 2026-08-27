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


# T136 — Add Android TV live channel zapping with D-pad and channel +/- remote keys

**Source**: GitHub Issue #288

## Description

## Context

Live TV on Android TV needs instant channel zapping without forcing the user to open the channel browser overlay for every change.

The desired TV-like behavior is:

- while watching Live TV full-screen, **DPAD_UP / DPAD_DOWN** changes channel directly;
- physical/remote **CHANNEL_UP / CHANNEL_DOWN** keys do the same when the device/remote exposes them;
- channel changes follow the current canonical channel ordering/context and use the canonical source-selection/failover flow;
- this must coexist cleanly with the side channel selector overlay from the dedicated overlay ticket.

## Goal

Implement robust remote key handling for fast next/previous Live TV channel changes in `apps/android-tv`.

## Full-screen playback behavior

When the Live player is in normal full-screen playback and no channel-list overlay/menu owns focus:

- `DPAD_UP` => previous/next channel according to the chosen navigation convention;
- `DPAD_DOWN` => the opposite direction;
- Android `KEYCODE_CHANNEL_UP` => next channel;
- Android `KEYCODE_CHANNEL_DOWN` => previous channel.

Choose and document a consistent D-pad mapping. Prefer the convention that feels most natural with the current app/player controls, but do not leave UP/DOWN unimplemented.

Channel +/- keys must work independently of D-pad mapping.

## Overlay interaction

When the channel selector overlay is open:

- DPAD_UP/DOWN navigate the overlay list and **must not immediately zap behind the overlay**;
- OK performs the selected switch while leaving the overlay open as specified in the overlay ticket;
- CHANNEL_UP/DOWN may still perform immediate zapping if this can be made predictable, but must keep overlay state/focus synchronized with the newly playing channel. If that creates ambiguous UX, explicitly scope CHANNEL_UP/DOWN to full-screen mode and document/test it.

Input ownership must be explicit so one key press cannot both move focus and switch channel.

## Channel order / context

Zapping should use canonical channels only.

Prefer this order:

1. current active category/list context when one exists;
2. otherwise the canonical default/all-channels order.

The behavior at list boundaries should be deliberate and consistent (wrap-around is preferred for traditional TV zapping unless existing product conventions strongly argue otherwise).

Skip channels that are known to be unplayable where the API already exposes that state.

## On-screen feedback

After a direct zap, briefly show a lightweight channel-change overlay containing at least:

- channel logo/name;
- current program when EPG exists;
- optional channel number/index if the product has a meaningful stable number.

This transient HUD should use the orange Live TV theme and auto-dismiss after a short interval. It must not require another key press.

Do not show fake EPG information.

## Player behavior / performance

- Switch media in-place where supported rather than recreating the entire Android activity/screen.
- Use canonical channel -> selected `ChannelSource` flow.
- Preserve automatic source fallback behavior.
- Avoid reloading the complete channel list on every zap.
- Debounce/serialize rapid channel switches so holding a key cannot create overlapping player requests or stale playback state.
- The last requested channel should win cleanly.

## Error behavior

If a channel cannot play after available source fallback:

- show a concise non-blocking error;
- keep the app usable;
- do not leave the player stuck in an inconsistent loading state;
- subsequent zapping must continue to work.

## Acceptance criteria

- [ ] Full-screen Live TV supports direct channel changes via DPAD_UP/DOWN.
- [ ] `KEYCODE_CHANNEL_UP` and `KEYCODE_CHANNEL_DOWN` are handled where Android delivers them.
- [ ] Zapping operates on canonical channels, not raw duplicate sources.
- [ ] Channel ordering/context is deterministic and boundary behavior is tested.
- [ ] Overlay-open UP/DOWN navigation does not accidentally trigger direct zapping.
- [ ] Direct zapping displays a brief orange channel/program HUD.
- [ ] Rapid key presses are serialized/debounced safely; no overlapping/stale player state.
- [ ] Source failover remains functional.
- [ ] Failed channel playback does not break later zapping.
- [ ] Existing VOD player remote controls are not regressed.
- [ ] Add Android input/player tests covering D-pad, channel keys, overlay ownership, wrap/boundaries, rapid zapping and playback failure.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All done. Here's a summary of everything implemented:

---

## Summary

### New files

| File | Purpose |
|---|---|
| `player/ChannelKeyEventBus.kt` | Singleton `object` with a `SharedFlow<ChannelKeyEvent>` — routes `KEYCODE_CHANNEL_UP/DOWN` from `MainActivity` to `PlayerScreen` |
| `player/ChannelZapper.kt` | Self-contained zapping logic: canonical channel list cache, index tracking, wrap-around, 150ms debounce (last key wins), HUD state, playback success/error notification |
| `player/ZapChannelHud.kt` | Transient orange-accented HUD composable showing channel logo, name, and current EPG program; auto-dismisses after 3s via `LaunchedEffect` |
| `player/ChannelZappingTest.kt` | 12 unit tests: next/prev advance, wrap-around at both boundaries, rapid-press debounce, failure revert, list-fetch idempotency, HUD lifecycle, no-op before init |

### Modified files

**`PlayerViewModel.kt`** — Added lazy `ChannelZapper`, public `zapNext()` / `zapPrevious()` / `clearZapHud()` / `zapHudChannel: StateFlow`, `initZapContext` triggered from `load()` for channel commands, `notifyPlaybackSuccess/Error` wired into the ExoPlayer listener.

**`PlayerScreen.kt`** — DPAD_UP→`zapPrevious()` / DPAD_DOWN→`zapNext()` in the chrome-hidden branch (overlay guard already above it, so overlay-open UP/DOWN are consumed before reaching this code). `LaunchedEffect(command?.id)` collects `ChannelKeyEventBus` for CHANNEL_UP/DOWN with the same overlay guard. `ZapChannelHud` rendered at bottom-end when `zapHudChannel != null`.

**`MainActivity.kt`** — `onKeyDown` override posts to `ChannelKeyEventBus` for `KEYCODE_CHANNEL_UP` and `KEYCODE_CHANNEL_DOWN`.

**`LiveChannelSwitchTest.kt`** — One new test confirming zap-path field propagation through `buildChannelSwitchCommand`.

**Result: 80 tests, 0 failures.**

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T136/reviews/implementation-review.md
- generated at: 2026-08-27T09:49:12Z

---

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