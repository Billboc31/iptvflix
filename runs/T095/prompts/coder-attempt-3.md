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


# T095 — Improve Continue Watching cards with direct resume, details and overflow actions

**Source**: GitHub Issue #195

## Description

## Context
The `Reprendre` / Continue Watching shelf should behave more like the reference UX shown by the user.

Today we already track playback progress and #194 adds the `Reprendre ou Recommencer` choice from normal `Lecture`. Continue Watching is different: being in this shelf already expresses resume intent, so the card should make resuming immediate while still giving access to details and management actions.

## Goal
Give every Continue Watching Movie/Episode card three clear interaction zones:

```text
┌──────────────────────┐
│      artwork         │
│          ▶           │  <- direct resume
│                      │
├──────────────────────┤
│ progress ━━━━━━━     │
│   ⓘ       ⋮          │
└──────────────────────┘
```

- central Play button: resume immediately from saved position;
- `ⓘ`: open the normal Movie/Series/Episode detail UI;
- `⋮`: open contextual actions, including `Supprimer de Reprendre`.

## 1. Direct resume action
The central Play action on a Continue Watching card MUST mean `Reprendre`.

Because the user is explicitly interacting with the Continue Watching shelf, do NOT show the #194 resume-vs-restart prompt for this central Play action.

Behavior:
- Movie -> resume that canonical Movie at saved absolute position;
- Episode -> resume that exact canonical Episode at saved absolute position;
- use selected/best playable availability through the normal playback resolver;
- clamp against true duration/seekable range;
- if the saved position cannot be resumed, provide a recoverable fallback instead of silently seeking to an unrelated position.

Normal `Lecture` from the detail page still follows #194 and can ask `Reprendre` vs `Recommencer`.

## 2. Progress visualization
Each Continue Watching card must show meaningful watch progress using TRUE duration semantics from #190:

`progress = savedPlaybackSeconds / trueMediaDuration`

Do not calculate the progress bar from buffered/loaded duration.

The bar must remain stable when reopening the app and must not grow/shrink simply because more of the stream buffered.

## 3. Details action
Add a clear `ⓘ` / `Détails` action on each Continue Watching card.

Movie:
- open the existing Movie detail modal.

Episode:
- open the relevant Series/detail experience with the correct season/episode context selected or clearly surfaced.

Reuse existing detail components. Do not create a separate Continue Watching detail implementation.

## 4. Overflow `…` menu
Add a three-dot contextual action menu for every Continue Watching item.

At minimum include:
- `Épisodes et infos` / `Détails` as appropriate;
- `Supprimer de Reprendre`.

Where existing product capabilities make sense, the menu may also expose actions such as:
- `Ma liste` / remove from My List;
- like/dislike/rating actions;
- source/availability information if useful.

Do not add unsupported decorative actions merely to imitate Netflix.

## 5. Remove from Continue Watching
`Supprimer de Reprendre` must immediately remove the item from this shelf for the current profile.

This needs an explicit persisted semantic — do NOT merely hide it in React state until refresh.

Choose a clean model such as a profile-level Continue Watching dismissal/suppression state tied to the canonical Movie/Episode and watch-progress record.

Requirements:
- removal persists across refresh/login/device;
- removing an Episode removes that Episode entry, not the whole Series history unless product semantics explicitly require otherwise;
- watch history/progress does not need to be destructively erased merely to hide the card;
- if the user later deliberately watches the title again and creates new meaningful progress, it should be eligible to re-enter Continue Watching;
- define/test the rule that clears a previous dismissal when new playback occurs.

## 6. Completion cleanup
Content effectively completed should naturally leave Continue Watching according to existing completion thresholds.

Do not require the user to manually remove every finished title.

## 7. Episode card identity
For Series entries, make it clear what is being resumed. Show useful context such as:
- Series title;
- `S02:E05` or equivalent;
- episode title where layout permits.

The card Play button must never accidentally resume a different episode from the one represented by the progress record.

## 8. Mobile/touch UX
The screenshots are primarily a mobile interaction reference. Implement this cleanly on touch:
- large central Play target;
- separate info target;
- separate `…` target;
- tapping `…` opens a bottom sheet/action sheet or equivalent touch-friendly menu;
- `Supprimer de Reprendre` is easy to understand and not accidentally triggered;
- sheet is dismissible with close/tap outside/swipe where existing modal primitives support it.

Desktop should provide equivalent actions without relying exclusively on hover.

## 9. Optimistic UI
For `Supprimer de Reprendre`, update the shelf immediately after successful intent, with robust rollback/error feedback if persistence fails.

Avoid a full-page reload.

## 10. Accessibility
- buttons have explicit labels (`Reprendre`, `Voir les détails`, `Plus d'options`);
- overflow menu/sheet has correct dialog/menu semantics;
- keyboard users can access all actions on desktop;
- focus returns sensibly after closing the action menu.

## Interaction with existing tickets
- #190: use true duration/progress semantics.
- #194: normal detail-page `Lecture` asks resume/restart; Continue Watching central Play resumes directly.
- player/progress work: reuse canonical Movie/Episode progress and playback resolver rather than adding a duplicate resume store.

## Acceptance criteria
- [ ] Every Continue Watching card has a central direct-resume Play action.
- [ ] Continue Watching Play resumes immediately without showing the #194 choice dialog.
- [ ] Movie resumes at its correct saved absolute position.
- [ ] Episode resumes the exact episode at its correct saved position.
- [ ] Progress bar uses true total duration, not buffer/load duration.
- [ ] `ⓘ` opens the existing appropriate details experience.
- [ ] `…` opens a contextual action menu/sheet.
- [ ] Menu includes `Supprimer de Reprendre`.
- [ ] Removing an item persists across refresh and other devices for the same profile.
- [ ] Removal does not unnecessarily destroy watch history/progress.
- [ ] New meaningful playback can make a previously dismissed title eligible for Continue Watching again.
- [ ] Completed content leaves Continue Watching according to completion rules.
- [ ] Series cards clearly identify the episode being resumed.
- [ ] Mobile controls are touch-friendly and desktop has equivalent accessible actions.
- [ ] No UUID/provider implementation details are shown to users.
- [ ] Tests cover direct resume, details action, persisted dismissal, re-entry after new playback and episode isolation.

## Completion rule
Manually validate with one partially watched Movie and one partially watched Episode: both appear in Continue Watching with stable progress; central Play resumes each directly at the saved position; info opens the correct detail UI; `… > Supprimer de Reprendre` removes the item and it stays removed after refresh; starting meaningful playback again makes it eligible to return.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

TypeScript propre. Voici un résumé des changements effectués :

---

## Fixes appliqués

**P1 — Feedback d'erreur lors du rollback optimistic (bloquant)**

- `useContinueWatching.ts` : ajout de `dismissError: string | null` et `dismissErrorFor: string | null`. `dismissItem` capture l'erreur en interne (sans throw) et met à jour ces états après rollback.
- `ContinueWatchingRow.tsx` : passe `dismissError` uniquement à la carte dont le `mediaId` correspond à `dismissErrorFor`.
- `ContinueWatchingCard.tsx` : reçoit `dismissError` en prop, supprime l'état local. `handleDismiss` catch-et-supprime (l'erreur remonte via le hook).
- Tests mis à jour : l'erreur est maintenant testée via le prop direct ; ajout de tests pour la navigation clavier.

**P2 — Navigation clavier dans le menu (bloquant)**

- `ContinueWatchingOverflowMenu.tsx` : focus automatique sur le premier `menuitem` à l'ouverture (`useEffect` au montage), et gestion `ArrowDown`/`ArrowUp` avec wrap cyclique.

**P3 — Débordement viewport (significatif)**

- `ContinueWatchingOverflowMenu.tsx` : ajout de `max-w-[min(208px,90vw)]` sur le conteneur du menu.

**P4 — Test trompeur (mineur)**

- `viewing-progress.test.ts` : renommage de `"dismissed item is absent from subsequent GET /continue-watching"` → `"GET returns empty list when leftJoin filters all dismissed items"`.

---

## Review

I now have all the information needed to write a complete review.

---

# PR Review — T095 Continue Watching: direct resume, details, overflow actions

## Résumé

L'implémentation couvre correctement l'essentiel du ticket : nouveau composant `ContinueWatchingCard` avec trois zones d'interaction, table de dismissal persistée avec contrainte unique, règle de ré-entrée sur `upsertProgress`, enrichissement des métadonnées épisode, UI optimiste avec rollback par carte, et guard `skipResumeDialog` dans `PlayerPage`. Le code est propre, les responsabilités bien séparées, et l'accessibilité ARIA est solide. Deux lacunes de tests couverts par les critères d'acceptance du ticket empêchent l'approbation.

## Vérifications effectuées

- Ticket complet (10 requirements + acceptance criteria)
- Plan (16 points)
- `continue-watching-dismissals.ts` schema + migration SQL
- `viewing-progress-service.ts` (listContinueWatching, dismissContinueWatching, upsertProgress)
- `viewing-progress.ts` routes
- `ContinueWatchingCard.tsx`, `ContinueWatchingOverflowMenu.tsx`, `ContinueWatchingRow.tsx`
- `useContinueWatching.ts`
- `PlayerPage.tsx` (skipResumeDialog guard)
- `user-state.ts` (ContinueWatchingItem type)
- `ContinueWatchingCard.test.tsx`, `ContinueWatchingRow.test.tsx`, `viewing-progress.test.ts`

## Points validés

**Backend**
- Schema `continue_watching_dismissals` : contrainte unique `(profileId, mediaType, mediaId)`, FK cascade vers `profiles`, `dismissedAt` timestamptz. Conforme au plan.
- Migration SQL cohérente avec le schéma Drizzle.
- `listContinueWatching` : LEFT JOIN + `IS NULL` pour exclure les dismissals — idiome SQL correct, exécuté en base et non en mémoire applicative.
- Filtre de progression 5 %–90 % appliqué en SQL.
- `dismissContinueWatching` : UPSERT idempotent, `dismissedAt` mis à jour à chaque appel.
- Règle de ré-entrée dans `upsertProgress` : dismissal supprimé dès que `progressSeconds >= durationSeconds * 0.05`. Tests couvrent les deux seuils (≥5 % → delete déclenché ; <5 % → aucun delete).
- Enrichissement épisodes : JOIN `seasons` pour `seasonNumber`, lookup séries pour titre et poster. Résolution en deux batches parallèles — efficace.
- Pas de touche aux lignes `viewing_progress` lors du dismissal. Historique préservé.
- Route `DELETE /continue-watching/:mediaType/:mediaId` : validation `mediaType`, 204 No Content.
- Tests backend couvrent : persistence, épisode-isolation, re-entry, champs episode vs movie null.

**Frontend**
- Progress bar : `(progressSeconds / durationSeconds) * 100`, clampé à 100, stable à l'ouverture, indépendant du buffer.
- Play button `aria-label="Reprendre"`, plein poster, navigue vers `/player/{mediaType}/{mediaId}?source=continue_watching`.
- `skipResumeDialog = searchParams.get('source') === 'continue_watching'` dans `PlayerPage` : guard correctement placé dans l'effet `loadedmetadata`, supprime le dialog #194.
- Bouton ⓘ `aria-label="Voir les détails"`, ⋮ `aria-label="Plus d'options"` avec `aria-haspopup="menu"` et `aria-expanded`.
- `ContinueWatchingOverflowMenu` : `role="menu"`, `role="menuitem"`, focus auto sur le premier item, navigation ArrowUp/Down avec wrapping, Escape ferme, focus retourne sur le trigger. Viewport protection `max-w-[min(208px,90vw)]`.
- Label épisode `S{n}E{n} · {titre}` affiché au bas du poster, titre omis si null.
- `useContinueWatching` : suppression optimiste, rollback sur échec API, erreur scopée par `mediaId` via `dismissErrorFor`.
- `ContinueWatchingRow` : passe `dismissError` par carte, aucune régression sur le rendu de la shelf.

## Problèmes détectés

### P1 — Bloquant : test d'action ⓘ (navigation détails) absent

Le ticket exige explicitement : *"Tests cover… details action"*. Le fichier `ContinueWatchingCard.test.tsx` ne contient aucun test vérifiant que cliquer sur ⓘ déclenche la navigation correcte :

- MOVIE → `/movies/${item.mediaId}` avec background state
- EPISODE → `/series/${item.seriesId}` avec background state

Seule l'existence du bouton (aria-label) est vérifiée. `handleDetails` n'est pas exercé.

**Correction attendue** : ajouter dans `ContinueWatchingCard.test.tsx` deux tests (un MOVIE, un EPISODE) qui cliquent sur ⓘ et vérifient la route atteinte via MemoryRouter.

---

### P2 — Bloquant : aucun test unitaire pour `useContinueWatching` (optimistic + rollback)

Le ticket exige un comportement d'UI optimiste avec rollback. Le hook `useContinueWatching.ts` n'a aucun fichier de test dédié. Le plan liste explicitement :

> *"Optimistic removal: item disappears immediately; reappears on API failure with error feedback."*

`ContinueWatchingCard.test.tsx` vérifie que la prop `dismissError` est affichée, mais ne vérifie pas que `useContinueWatching` supprime l'item optimistement ni qu'il le restaure sur échec API.

**Correction attendue** : créer `useContinueWatching.test.ts` (ou équivalent) avec au moins :
1. `dismissItem` supprime l'item de `items` avant la résolution API
2. En cas d'erreur API, `items` est restauré et `dismissError` est positionné

---

### P3 — Observation non-bloquante : absence de bottom sheet mobile

Le plan (point 13) indique : *"Mobile: bottom sheet (fixed overlay, tap-outside or swipe to dismiss)"*. L'implémentation utilise un dropdown positionné `bottom-full right-0` identique sur desktop et mobile. Le ticket accepte *"ou equivalent touch-friendly menu"*, donc la déviation est défendable, mais elle doit être documentée ou assumée.

Pas de blocage si le dropdown se comporte correctement sur touch (ce qui est le cas avec click-outside et Escape), mais à mentionner lors du QA manuel mobile.

---

### P4 — Observation non-bloquante : taille des touch targets ⓘ et ⋮

Les boutons info et overflow font `w-6 h-6` (24 px). La cible WCAG mobile recommandée est 44 px. Dans une card de 144 px de large avec trois zones, c'est une contrainte de layout réelle, mais le ticket mentionne "separate info target" et "separate ⋮ target" touch-friendly. Envisager `min-w-[44px] min-h-[44px]` via `p-2` ou un wrapper étendu pour compenser sans agrandir visuellement le bouton.

---

### P5 — Observation : silence silencieux si EPISODE sans seriesId

`handleDetails` pour EPISODE ne navigue pas si `item.seriesId` est null (cas improbable mais typiquement possible). Aucun fallback, aucun log. Le type autorise `null`. Trivial à corriger :

```ts
} else if (item.seriesId) {
  navigate(...)
} else {
  // fallback: open episode or log warning
}
```

## Risques éventuels

- Le guard `skipResumeDialog` dépend du query param URL : un lien externe ou une URL copiée avec `?source=continue_watching` bypasserait également le dialog. Comportement acceptable dans le contexte actuel (le dialog #194 n'est pas encore livré).
- Le `beforeEach` dans `viewing-progress.test.ts` initialise un mock `setupDelete()` qui est consommé par `upsertProgress`. Le test "does not clear dismissal" fait `mockDb.delete.mockClear()` pour réinitialiser — pattern fragile si l'ordre des appels mock change. Non-bloquant mais à surveiller.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Ajouter dans `ContinueWatchingCard.test.tsx` les tests de click ⓘ : navigation `/movies/:id` (MOVIE) et `/series/:seriesId` (EPISODE).
2. **[Bloquant]** Créer des tests pour `useContinueWatching` couvrant la suppression optimiste et le rollback sur échec API.
3. **[Optionnel]** Documenter dans le plan ou une note le choix dropdown vs bottom sheet mobile.
4. **[Optionnel]** Augmenter la zone tactile de ⓘ et ⋮ ou ajouter une note de QA mobile.
5. **[Optionnel]** Ajouter un fallback dans `handleDetails` pour EPISODE sans `seriesId`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T095/reviews/implementation-review.md
- generated at: 2026-08-18T13:35:59Z

---

I now have all the information needed to write a complete review.

---

# PR Review — T095 Continue Watching: direct resume, details, overflow actions

## Résumé

L'implémentation couvre correctement l'essentiel du ticket : nouveau composant `ContinueWatchingCard` avec trois zones d'interaction, table de dismissal persistée avec contrainte unique, règle de ré-entrée sur `upsertProgress`, enrichissement des métadonnées épisode, UI optimiste avec rollback par carte, et guard `skipResumeDialog` dans `PlayerPage`. Le code est propre, les responsabilités bien séparées, et l'accessibilité ARIA est solide. Deux lacunes de tests couverts par les critères d'acceptance du ticket empêchent l'approbation.

## Vérifications effectuées

- Ticket complet (10 requirements + acceptance criteria)
- Plan (16 points)
- `continue-watching-dismissals.ts` schema + migration SQL
- `viewing-progress-service.ts` (listContinueWatching, dismissContinueWatching, upsertProgress)
- `viewing-progress.ts` routes
- `ContinueWatchingCard.tsx`, `ContinueWatchingOverflowMenu.tsx`, `ContinueWatchingRow.tsx`
- `useContinueWatching.ts`
- `PlayerPage.tsx` (skipResumeDialog guard)
- `user-state.ts` (ContinueWatchingItem type)
- `ContinueWatchingCard.test.tsx`, `ContinueWatchingRow.test.tsx`, `viewing-progress.test.ts`

## Points validés

**Backend**
- Schema `continue_watching_dismissals` : contrainte unique `(profileId, mediaType, mediaId)`, FK cascade vers `profiles`, `dismissedAt` timestamptz. Conforme au plan.
- Migration SQL cohérente avec le schéma Drizzle.
- `listContinueWatching` : LEFT JOIN + `IS NULL` pour exclure les dismissals — idiome SQL correct, exécuté en base et non en mémoire applicative.
- Filtre de progression 5 %–90 % appliqué en SQL.
- `dismissContinueWatching` : UPSERT idempotent, `dismissedAt` mis à jour à chaque appel.
- Règle de ré-entrée dans `upsertProgress` : dismissal supprimé dès que `progressSeconds >= durationSeconds * 0.05`. Tests couvrent les deux seuils (≥5 % → delete déclenché ; <5 % → aucun delete).
- Enrichissement épisodes : JOIN `seasons` pour `seasonNumber`, lookup séries pour titre et poster. Résolution en deux batches parallèles — efficace.
- Pas de touche aux lignes `viewing_progress` lors du dismissal. Historique préservé.
- Route `DELETE /continue-watching/:mediaType/:mediaId` : validation `mediaType`, 204 No Content.
- Tests backend couvrent : persistence, épisode-isolation, re-entry, champs episode vs movie null.

**Frontend**
- Progress bar : `(progressSeconds / durationSeconds) * 100`, clampé à 100, stable à l'ouverture, indépendant du buffer.
- Play button `aria-label="Reprendre"`, plein poster, navigue vers `/player/{mediaType}/{mediaId}?source=continue_watching`.
- `skipResumeDialog = searchParams.get('source') === 'continue_watching'` dans `PlayerPage` : guard correctement placé dans l'effet `loadedmetadata`, supprime le dialog #194.
- Bouton ⓘ `aria-label="Voir les détails"`, ⋮ `aria-label="Plus d'options"` avec `aria-haspopup="menu"` et `aria-expanded`.
- `ContinueWatchingOverflowMenu` : `role="menu"`, `role="menuitem"`, focus auto sur le premier item, navigation ArrowUp/Down avec wrapping, Escape ferme, focus retourne sur le trigger. Viewport protection `max-w-[min(208px,90vw)]`.
- Label épisode `S{n}E{n} · {titre}` affiché au bas du poster, titre omis si null.
- `useContinueWatching` : suppression optimiste, rollback sur échec API, erreur scopée par `mediaId` via `dismissErrorFor`.
- `ContinueWatchingRow` : passe `dismissError` par carte, aucune régression sur le rendu de la shelf.

## Problèmes détectés

### P1 — Bloquant : test d'action ⓘ (navigation détails) absent

Le ticket exige explicitement : *"Tests cover… details action"*. Le fichier `ContinueWatchingCard.test.tsx` ne contient aucun test vérifiant que cliquer sur ⓘ déclenche la navigation correcte :

- MOVIE → `/movies/${item.mediaId}` avec background state
- EPISODE → `/series/${item.seriesId}` avec background state

Seule l'existence du bouton (aria-label) est vérifiée. `handleDetails` n'est pas exercé.

**Correction attendue** : ajouter dans `ContinueWatchingCard.test.tsx` deux tests (un MOVIE, un EPISODE) qui cliquent sur ⓘ et vérifient la route atteinte via MemoryRouter.

---

### P2 — Bloquant : aucun test unitaire pour `useContinueWatching` (optimistic + rollback)

Le ticket exige un comportement d'UI optimiste avec rollback. Le hook `useContinueWatching.ts` n'a aucun fichier de test dédié. Le plan liste explicitement :

> *"Optimistic removal: item disappears immediately; reappears on API failure with error feedback."*

`ContinueWatchingCard.test.tsx` vérifie que la prop `dismissError` est affichée, mais ne vérifie pas que `useContinueWatching` supprime l'item optimistement ni qu'il le restaure sur échec API.

**Correction attendue** : créer `useContinueWatching.test.ts` (ou équivalent) avec au moins :
1. `dismissItem` supprime l'item de `items` avant la résolution API
2. En cas d'erreur API, `items` est restauré et `dismissError` est positionné

---

### P3 — Observation non-bloquante : absence de bottom sheet mobile

Le plan (point 13) indique : *"Mobile: bottom sheet (fixed overlay, tap-outside or swipe to dismiss)"*. L'implémentation utilise un dropdown positionné `bottom-full right-0` identique sur desktop et mobile. Le ticket accepte *"ou equivalent touch-friendly menu"*, donc la déviation est défendable, mais elle doit être documentée ou assumée.

Pas de blocage si le dropdown se comporte correctement sur touch (ce qui est le cas avec click-outside et Escape), mais à mentionner lors du QA manuel mobile.

---

### P4 — Observation non-bloquante : taille des touch targets ⓘ et ⋮

Les boutons info et overflow font `w-6 h-6` (24 px). La cible WCAG mobile recommandée est 44 px. Dans une card de 144 px de large avec trois zones, c'est une contrainte de layout réelle, mais le ticket mentionne "separate info target" et "separate ⋮ target" touch-friendly. Envisager `min-w-[44px] min-h-[44px]` via `p-2` ou un wrapper étendu pour compenser sans agrandir visuellement le bouton.

---

### P5 — Observation : silence silencieux si EPISODE sans seriesId

`handleDetails` pour EPISODE ne navigue pas si `item.seriesId` est null (cas improbable mais typiquement possible). Aucun fallback, aucun log. Le type autorise `null`. Trivial à corriger :

```ts
} else if (item.seriesId) {
  navigate(...)
} else {
  // fallback: open episode or log warning
}
```

## Risques éventuels

- Le guard `skipResumeDialog` dépend du query param URL : un lien externe ou une URL copiée avec `?source=continue_watching` bypasserait également le dialog. Comportement acceptable dans le contexte actuel (le dialog #194 n'est pas encore livré).
- Le `beforeEach` dans `viewing-progress.test.ts` initialise un mock `setupDelete()` qui est consommé par `upsertProgress`. Le test "does not clear dismissal" fait `mockDb.delete.mockClear()` pour réinitialiser — pattern fragile si l'ordre des appels mock change. Non-bloquant mais à surveiller.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[Bloquant]** Ajouter dans `ContinueWatchingCard.test.tsx` les tests de click ⓘ : navigation `/movies/:id` (MOVIE) et `/series/:seriesId` (EPISODE).
2. **[Bloquant]** Créer des tests pour `useContinueWatching` couvrant la suppression optimiste et le rollback sur échec API.
3. **[Optionnel]** Documenter dans le plan ou une note le choix dropdown vs bottom sheet mobile.
4. **[Optionnel]** Augmenter la zone tactile de ⓘ et ⋮ ou ajouter une note de QA mobile.
5. **[Optionnel]** Ajouter un fallback dans `handleDetails` pour EPISODE sans `seriesId`.

IMPLEMENTATION_FIX_REQUIRED