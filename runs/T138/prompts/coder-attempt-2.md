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


# T138 — Add Android TV universal channel/program search with voice and smart live launch

**Source**: GitHub Issue #293

## Description

## Context

Android TV Live should let the user search for **what they want to watch**, not force them to know which channel carries it.

Examples:
- `TF1` → show/open TF1.
- `US Open` → show channels broadcasting it right now plus upcoming broadcasts.
- `Fort Boyard` → if currently live, show the channel(s); if later, show channel + date/time.
- Voice query: `Je veux regarder l'US Open` should behave like a search for `US Open`.

This ticket consumes the universal canonical-channel + EPG search backend from the dedicated search API ticket.

## Goal

Create a remote-first **universal Live TV search screen for Android TV**, supporting text and Android TV voice input, with results grouped by current/future availability and smart playback behavior.

Use the Live TV **dark + orange** visual identity.

## Entry point

Expose Search as a first-class TV-mode destination/action accessible entirely with the remote.

Support:
- on-screen keyboard/text input through normal Android TV mechanisms;
- hardware/remote text input where Android provides it;
- Android TV voice search / microphone input where supported and permitted by the platform/device.

Voice is converted to the same search query used by text search; do not build a separate search algorithm.

## Result UX

Prefer a simple large-screen hierarchy:

### En direct maintenant
For matching programs airing now, show cards/rows with:
- canonical channel logo + name;
- program title;
- start/end and/or progress;
- clear `EN DIRECT` state;
- orange focus state.

### À venir
For matching future programs, show:
- canonical channel logo + name;
- program title;
- **date + local time prominently**;
- optionally relative wording (`ce soir`, `demain`) only in addition to an unambiguous date/time where useful.

Sort useful upcoming results chronologically after relevance.

### Chaînes
For direct channel-name matches, show canonical channel cards separately where appropriate.

Do not show raw provider/source duplicates.

## Smart launch behavior

### One unambiguous result currently live
When the search has **exactly one high-confidence playable LIVE_NOW result** and no meaningful ambiguity:
- allow fast direct playback;
- product may auto-launch it after a very short visible/cancellable affordance, or require one OK press if that is safer with the existing Android TV interaction model;
- in either implementation, getting from `US Open` to the only channel currently showing it should require minimal friction.

Do not auto-launch weak/fuzzy matches.

### Multiple live results
Show all matching channels and let the user choose with the D-pad + OK.

### Future-only results
Never start a channel merely because the requested program will air later.
Show the upcoming result list with **channel + date + time**.

### Live + future
Prioritize `En direct maintenant`; keep future occurrences visible below.

## Playback integration

Selecting a live result:
- starts the canonical channel through the same source-selection/failover path used by Live TV playback;
- enters the normal Live player;
- all existing zapping and channel-overlay behaviors remain available afterward.

Selecting a direct channel result starts that channel normally.

Selecting an upcoming program does not fake playback. For this ticket it may simply focus/show its schedule details; future reminder functionality can build on the program identifier later.

## Search interaction

- Debounce incremental text queries appropriately.
- Preserve query/result state when backing out of a result/player where sensible.
- Focus must be deterministic when result groups appear/update.
- Empty state should distinguish `aucun programme trouvé` from network/API failure.
- Search should remain usable when EPG is missing: channel-name search still works.

## Voice UX

Where Android TV microphone/voice APIs are available:
- microphone action is clearly focusable;
- spoken text is visible as the resulting query;
- user can edit/retry it;
- gracefully fall back to text search on devices without voice capability.

No always-listening microphone behavior.

## Future-ready reminder affordance

Keep the upcoming-result component/API integration ready for a future action such as:
- `Me prévenir au début`;
- `Ajouter à mes événements TV`.

Do not implement reminder scheduling in this ticket unless an existing generic reminder mechanism already makes it trivial.

## Acceptance criteria

- [ ] Android TV Live exposes universal Search accessible with D-pad.
- [ ] Search can find canonical channels by name.
- [ ] Search can find EPG programs such as `US Open` / `Fort Boyard` and separate current from upcoming broadcasts.
- [ ] `En direct maintenant` results display channel + program information and can launch playback.
- [ ] `À venir` results prominently display canonical channel + date + time and do not launch as though already live.
- [ ] Multiple current broadcasters are presented as a selectable list.
- [ ] A single high-confidence currently-live result has a minimal-friction launch path without auto-launching fuzzy/ambiguous results.
- [ ] Voice input uses Android TV-supported microphone/search mechanisms where available and falls back cleanly to text.
- [ ] Orange Live TV focus/active styling is used throughout.
- [ ] Raw duplicate `ChannelSource` entries never appear as separate results.
- [ ] Playback uses canonical source selection/failover and integrates with existing Live player/zapping/side-overlay features.
- [ ] Search remains useful for channels when EPG is unavailable.
- [ ] Add Android tests for channel search, live program search, upcoming-only search, multiple live matches, unique-live fast launch, voice/text query flow, focus restoration and no-EPG behavior.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tests pass. Here's a summary of the implementation:

## Files modified

**`livetv/ChannelRepository.kt`** — added `searchLiveTV(query)` delegating to the existing `api.searchLiveTV()`, propagating exceptions so callers own the error state.

**`livetv/LiveTvHomeScreen.kt`** — added `onOpenSearch: () -> Unit = {}` parameter; header row now has a focusable "⌕ Rechercher" button that calls it; propagated through `ReadyContent`.

**`AppNavGraph.kt`** — added `LiveTvSearch` to the `Screen` enum; wired `onOpenSearch` on `LiveTvHome`; added the `LiveTvSearch` branch rendering `LiveSearchScreen` with `onLiveNowSelected` and `onChannelSelected` both building a `PlaybackCommand(mediaType = "channel", …)` and navigating to `Screen.Player`.

## Files created

**`livetv/LiveSearchViewModel.kt`** — sealed state `Idle | Loading | Results | NoResults | Error`; `onQueryChanged` with 400ms debounce via job cancellation; `onVoiceResult` re-enters the same path; `clearQuery` cancels and resets to `Idle`; `isSingleLiveNowResult` computed from current state; companion `factory`.

**`livetv/LiveSearchScreen.kt`** — full-screen composable: search bar with `BasicTextField` + orange underline-on-focus + conditional mic button via `RecognizerIntent`; `TvLazyColumn` result sections "En direct maintenant" / "À venir" / "Chaînes" each with orange 3dp focus border; single-live result auto-focuses and shows "Lancer · EN DIRECT" label; upcoming items are focusable but do not launch playback; empty/loading/error/idle states.

**`test/livetv/LiveSearchViewModelTest.kt`** — 11 JUnit 4 + MockK tests covering all plan scenarios; uses `advanceUntilIdle()` to drain the debounce delay in virtual time.

---

## Review

I now have a complete picture of the implementation. Let me compile the review.

---

## Review — T138 Android TV Universal Live Search

### Périmètre couvert

L'implémentation couvre l'ensemble des exigences fonctionnelles du ticket :

- `LiveSearchViewModel.kt` — sealed state correct (`Idle | Loading | Results | NoResults | Error`), debounce 400 ms via job cancellation, `onVoiceResult` réentrant sur `onQueryChanged`, `isSingleLiveNowResult` dérivé proprement depuis le state.
- `LiveSearchScreen.kt` — composable complet : barre de recherche avec orange focus underline, bouton micro conditionnel via `RecognizerIntent` + `PackageManager.resolveActivity`, trois sections résultats dans un `TvLazyColumn`, focus D-pad déterministe sur le premier item de la première section non-vide, états idle/loading/error/no-results.
- `ChannelRepository.kt` — ajout minimal de `searchLiveTV` propageant les exceptions, conforme au plan.
- `AppNavGraph.kt` — `LiveTvSearch` dans l'enum, câblage `onOpenSearch` / `onChannelSelected` / `onLiveNowSelected` conforme au pattern existant.
- `LiveTvHomeScreen.kt` — paramètre `onOpenSearch` ajouté, bouton "Rechercher" D-pad accessible.
- `LiveSearchViewModelTest.kt` — 11 tests couvrant tous les scénarios du plan.

### Problème bloquant (non corrigé depuis la première review)

**`LiveSearchScreen.kt:725-733` — Affichage de l'heure UTC sans conversion timezone**

```kotlin
// ISO-8601 "2026-08-27T20:30:00Z" → "20:30"
private fun formatIsoTime(isoTime: String): String =
    isoTime.substringAfter('T', isoTime).take(5)

// ISO-8601 "2026-08-27T20:30:00Z" → "27/08"
private fun formatIsoDateShort(isoTime: String): String {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

Le backend retourne des timestamps UTC (suffixe `Z`, confirmé par les fixtures de test : `"2026-08-27T21:00:00Z"`). Ces deux fonctions extraient la composante temporelle brute sans convertir vers la timezone locale du device. Pour un utilisateur en France (UTC+2 en été), `"21:00Z"` s'affiche `"21:00"` au lieu de `"23:00"`.

Le ticket exige explicitement **"date + local time prominently"** dans la section "À venir". Ce bug est une violation fonctionnelle directe de cette exigence.

`formatIsoTime` est utilisé également dans `LiveNowRow` (ligne 506) pour afficher les horaires start/end — même défaut, même correctif requis.

**Correction attendue :**

```kotlin
import java.time.ZonedDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun formatIsoTime(isoTime: String): String = runCatching {
    ZonedDateTime.parse(isoTime)
        .withZoneSameInstant(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrElse { isoTime.substringAfter('T', isoTime).take(5) }

private fun formatIsoDateShort(isoTime: String): String = runCatching {
    val local = ZonedDateTime.parse(isoTime).withZoneSameInstant(ZoneId.systemDefault())
    "${local.dayOfMonth.toString().padStart(2, '0')}/${local.monthValue.toString().padStart(2, '0')}"
}.getOrElse {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

`java.time.ZonedDateTime` est disponible depuis API 26 (minimum supporté par les projets Android TV modernes) — pas de dépendance nouvelle requise.

### Observations mineures (non bloquantes)

- **Tests de formatage absents** : aucun test unitaire ne vérifie `formatIsoTime`. Après correction, un test de conversion timezone (ex. UTC `"21:00Z"` → `"23:00"` en UTC+2) renforcerait la confiance, mais ce n'est pas dans le scope défini du plan.
- **`@Suppress("DEPRECATION")` sur `resolveActivity`** : correct pour la compatibilité pre-API 33, annotation appropriée.
- **`UpcomingRow` focusable sans affordance textuelle** : le focus border orange s'affiche (correct), mais l'absence de toute action sur OK n'est pas communiquée à l'utilisateur. Acceptable pour ce ticket (reminder stub = no-op), mais à noter pour l'évolution future.

### Verdict

Le problème bloquant de la première review (**formatage d'heure UTC sans conversion locale**) n'a **pas été corrigé**. L'implémentation ne peut pas être approuvée en l'état.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T138/reviews/implementation-review.md
- generated at: 2026-08-27T14:45:59Z

---

I now have a complete picture of the implementation. Let me compile the review.

---

## Review — T138 Android TV Universal Live Search

### Périmètre couvert

L'implémentation couvre l'ensemble des exigences fonctionnelles du ticket :

- `LiveSearchViewModel.kt` — sealed state correct (`Idle | Loading | Results | NoResults | Error`), debounce 400 ms via job cancellation, `onVoiceResult` réentrant sur `onQueryChanged`, `isSingleLiveNowResult` dérivé proprement depuis le state.
- `LiveSearchScreen.kt` — composable complet : barre de recherche avec orange focus underline, bouton micro conditionnel via `RecognizerIntent` + `PackageManager.resolveActivity`, trois sections résultats dans un `TvLazyColumn`, focus D-pad déterministe sur le premier item de la première section non-vide, états idle/loading/error/no-results.
- `ChannelRepository.kt` — ajout minimal de `searchLiveTV` propageant les exceptions, conforme au plan.
- `AppNavGraph.kt` — `LiveTvSearch` dans l'enum, câblage `onOpenSearch` / `onChannelSelected` / `onLiveNowSelected` conforme au pattern existant.
- `LiveTvHomeScreen.kt` — paramètre `onOpenSearch` ajouté, bouton "Rechercher" D-pad accessible.
- `LiveSearchViewModelTest.kt` — 11 tests couvrant tous les scénarios du plan.

### Problème bloquant (non corrigé depuis la première review)

**`LiveSearchScreen.kt:725-733` — Affichage de l'heure UTC sans conversion timezone**

```kotlin
// ISO-8601 "2026-08-27T20:30:00Z" → "20:30"
private fun formatIsoTime(isoTime: String): String =
    isoTime.substringAfter('T', isoTime).take(5)

// ISO-8601 "2026-08-27T20:30:00Z" → "27/08"
private fun formatIsoDateShort(isoTime: String): String {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    return if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

Le backend retourne des timestamps UTC (suffixe `Z`, confirmé par les fixtures de test : `"2026-08-27T21:00:00Z"`). Ces deux fonctions extraient la composante temporelle brute sans convertir vers la timezone locale du device. Pour un utilisateur en France (UTC+2 en été), `"21:00Z"` s'affiche `"21:00"` au lieu de `"23:00"`.

Le ticket exige explicitement **"date + local time prominently"** dans la section "À venir". Ce bug est une violation fonctionnelle directe de cette exigence.

`formatIsoTime` est utilisé également dans `LiveNowRow` (ligne 506) pour afficher les horaires start/end — même défaut, même correctif requis.

**Correction attendue :**

```kotlin
import java.time.ZonedDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private fun formatIsoTime(isoTime: String): String = runCatching {
    ZonedDateTime.parse(isoTime)
        .withZoneSameInstant(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrElse { isoTime.substringAfter('T', isoTime).take(5) }

private fun formatIsoDateShort(isoTime: String): String = runCatching {
    val local = ZonedDateTime.parse(isoTime).withZoneSameInstant(ZoneId.systemDefault())
    "${local.dayOfMonth.toString().padStart(2, '0')}/${local.monthValue.toString().padStart(2, '0')}"
}.getOrElse {
    val date = isoTime.substringBefore('T', isoTime)
    val parts = date.split('-')
    if (parts.size == 3) "${parts[2]}/${parts[1]}" else date
}
```

`java.time.ZonedDateTime` est disponible depuis API 26 (minimum supporté par les projets Android TV modernes) — pas de dépendance nouvelle requise.

### Observations mineures (non bloquantes)

- **Tests de formatage absents** : aucun test unitaire ne vérifie `formatIsoTime`. Après correction, un test de conversion timezone (ex. UTC `"21:00Z"` → `"23:00"` en UTC+2) renforcerait la confiance, mais ce n'est pas dans le scope défini du plan.
- **`@Suppress("DEPRECATION")` sur `resolveActivity`** : correct pour la compatibilité pre-API 33, annotation appropriée.
- **`UpcomingRow` focusable sans affordance textuelle** : le focus border orange s'affiche (correct), mais l'absence de toute action sur OK n'est pas communiquée à l'utilisateur. Acceptable pour ce ticket (reminder stub = no-op), mais à noter pour l'évolution future.

### Verdict

Le problème bloquant de la première review (**formatage d'heure UTC sans conversion locale**) n'a **pas été corrigé**. L'implémentation ne peut pas être approuvée en l'état.

IMPLEMENTATION_FIX_REQUIRED