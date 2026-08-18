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

Implementation complete. Here's a summary of what was done:

---

## T095 — Implementation summary

**Files created (5):**
- `apps/api/migrations/0042_t095_continue_watching_dismissals.sql` — migration for the new table
- `apps/api/src/db/schema/continue-watching-dismissals.ts` — Drizzle schema (profileId + mediaType + mediaId unique, cascades on profile delete)
- `apps/web/src/components/content/ContinueWatchingCard.tsx` — card with three interaction zones (▶ Play, ⓘ Info, ⋮ Overflow)
- `apps/web/src/components/content/ContinueWatchingOverflowMenu.tsx` — accessible dropdown menu (role="menu", Escape/click-outside to close)
- `apps/web/src/components/content/ContinueWatchingCard.test.tsx` — 14 component tests

**Files modified (12):**
- `apps/api/migrations/meta/_journal.json` — journal entry for migration 42
- `apps/api/src/db/schema/index.ts` — export new schema
- `packages/api-contracts/src/user-state.ts` — `ContinueWatchingItem` extended with `seriesId/seasonNumber/episodeNumber/episodeTitle`
- `apps/api/src/services/viewing-progress-service.ts` — `listContinueWatching` filters dismissed items (LEFT JOIN + isNull), enriches episode items (joined seasons), new `dismissContinueWatching`, `upsertProgress` clears dismissal on ≥5% (re-entry rule)
- `apps/api/src/routes/viewing-progress.ts` — `DELETE /continue-watching/:mediaType/:mediaId`
- `apps/api/src/routes/__tests__/viewing-progress.test.ts` — 19 tests (expanded from 11, covering dismissal, episode fields, re-entry)
- `apps/web/src/lib/api.ts` — `dismissContinueWatching()`
- `apps/web/src/hooks/useContinueWatching.ts` — `dismissItem` with optimistic removal + rollback
- `apps/web/src/components/content/ContinueWatchingRow.tsx` — now uses `ContinueWatchingCard`
- `apps/web/src/pages/PlayerPage.tsx` — skips resume dialog when `source=continue_watching`
- `apps/web/src/test/handlers.ts` — extended `MOCK_CONTINUE_WATCHING` + `MOCK_CONTINUE_WATCHING_EPISODE` + DELETE handler
- `apps/web/src/components/content/ContinueWatchingRow.test.tsx` — updated for new card structure

**All 19 backend + 17 frontend tests pass. TypeScript compiles cleanly on all changed files.**

---

## Review

I have enough information to write the full review.

---

# PR Review — T095: Improve Continue Watching cards with direct resume, details and overflow actions

## Résumé

L'implémentation couvre correctement le schéma de persistance des dismissals, l'enrichissement des données d'épisode, la navigation depuis le player, et la logique de ré-entrée après nouvelle lecture. Deux problèmes bloquants ont été identifiés : un bug de feedback utilisateur perdu lors d'un rollback d'optimistic UI, et une lacune d'accessibilité clavier dans le menu déroulant que le ticket impose explicitement (§10).

---

## Vérifications effectuées

- Ticket T095 (§1–§10 + critères d'acceptation)
- Plan (`runs/T095/plan.md`)
- Schema + migration : `continue-watching-dismissals.ts`, `0042_t095_continue_watching_dismissals.sql`
- Service : `viewing-progress-service.ts` (upsertProgress, dismissContinueWatching, listContinueWatching)
- Routes : `viewing-progress.ts`
- Contracts : `user-state.ts`
- Hook : `useContinueWatching.ts`
- Composants : `ContinueWatchingCard.tsx`, `ContinueWatchingOverflowMenu.tsx`, `ContinueWatchingRow.tsx`
- PlayerPage : flag `skipResumeDialog`
- Tests backend : `viewing-progress.test.ts`
- Tests frontend : `ContinueWatchingCard.test.tsx`, `ContinueWatchingRow.test.tsx`

---

## Points validés

**Backend**
- Table `continue_watching_dismissals` avec contrainte unique `(profileId, mediaType, mediaId)` et FK cascade sur profiles. ✓
- `listContinueWatching` : LEFT JOIN + IS NULL pour exclure les items dismissés ; filtres 5 %–90 % corrects via SQL `progressSeconds >= durationSeconds * 0.05` et `< 0.90`. ✓
- `upsertProgress` efface le dismissal dès que la progression ≥ 5 %, permettant la ré-entrée. ✓
- `dismissContinueWatching` est idempotent (`ON CONFLICT DO UPDATE`). ✓
- Isolation par épisode : le dismissal porte sur `(profileId, mediaType, mediaId)`, donc un épisode A dismissed ne retire pas l'épisode B. ✓
- L'historique de visionnage (`viewing_progress`) n'est pas détruit lors d'un dismissal. ✓
- Enrichissement épisodes : `seriesId`, `seasonNumber`, `episodeNumber`, `episodeTitle` propagés via JOIN `episodes → seasons → series`. ✓
- Movies renvoient `null` pour les quatre champs épisode. ✓

**Frontend**
- `ContinueWatchingCard` : trois zones d'interaction distinctes (Play, ⓘ, ⋮). ✓
- Progress bar : `progressSeconds / durationSeconds * 100`, stable (pas de durée bufférisée). ✓
- `?source=continue_watching` dans l'URL → `skipResumeDialog = true` → lecture directe sans dialog de choix #194. ✓
- `ⓘ` ouvre `MovieDetailPage` pour MOVIE, `SeriesDetailPage` via `seriesId` pour EPISODE. ✓
- Episode label : `S{n}E{n} · {title}` (title omis si null) ; absent pour les films. ✓
- `aria-label` corrects sur les trois boutons (`Reprendre`, `Voir les détails`, `Plus d'options`). ✓
- `aria-haspopup="menu"` et `aria-expanded` sur le trigger ⋮. ✓
- Fermeture menu sur Escape et click-outside ; retour focus au trigger. ✓
- API client : `dismissContinueWatching` → `DELETE /continue-watching/:mediaType/:mediaId`. ✓

---

## Problèmes détectés

### 🔴 P1 — Bug : feedback d'erreur perdu lors du rollback optimistic

**Fichiers** : `useContinueWatching.ts` + `ContinueWatchingCard.tsx`

`dismissItem` (hook) retire l'item de `items` **avant** d'attendre la réponse API. Le composant card est donc démonté. Si l'appel API échoue :

1. Le hook restore `previous` → le composant est remonté (nouvelle instance, `dismissError = null`).
2. Le `catch` de `handleDismiss` dans l'ancienne instance appelle `setDismissError(...)` sur un composant déjà démonté → la mise à jour est silencieusement ignorée en React 18.
3. La carte remontée affiche **aucun message d'erreur** malgré l'échec.

Le test `"shows error message when dismiss fails"` passe parce qu'il utilise un mock `onDismiss` qui ne déclenche pas le retrait optimistic — il ne teste pas le vrai flux.

**Correction** : déplacer la gestion d'erreur dans le hook plutôt que dans le composant, et passer l'erreur via une prop ou un état partagé dans `ContinueWatchingRow`.

---

### 🔴 P2 — Accessibilité : navigation clavier absente dans le menu

**Fichier** : `ContinueWatchingOverflowMenu.tsx`

Le composant utilise `role="menu"` et `role="menuitem"`, ce qui engage le pattern ARIA *Menu Button* (APG). Ce pattern impose :

- Au ouverture du menu, le focus se déplace automatiquement sur le premier `menuitem`.
- `ArrowDown` / `ArrowUp` cyclent entre les items.
- `Escape` ferme et retourne le focus au trigger.

L'implémentation gère uniquement Escape et click-outside. Le focus ne se déplace pas au premier item à l'ouverture, et les flèches ne fonctionnent pas. Les utilisateurs clavier ne peuvent pas utiliser le menu normalement sur desktop.

Ticket §10 : *"keyboard users can access all actions on desktop"* — critère d'acceptation explicite.

**Correction** : au montage du menu, déplacer le focus sur le premier bouton (`menuRef.current?.querySelector('button')?.focus()`). Ajouter un gestionnaire `keydown` sur le container qui intercepte `ArrowDown`/`ArrowUp`.

---

### 🟡 P3 — Menu déroulant : débordement viewport sur mobile

**Fichier** : `ContinueWatchingOverflowMenu.tsx`

La carte fait `w-36` (144 px). Le menu fait `w-52` (208 px) positionné `absolute right-0`. Sur les cartes en position gauche du carrousel ou sur petit écran, le menu dépasse le bord gauche du viewport. Il n'y a pas de détection de bord ni d'adaptation mobile.

Le plan prévoit un *bottom sheet* pour mobile. Le ticket §8 demande "tapping ⋮ opens a bottom sheet/action sheet **or equivalent touch-friendly menu**". Un dropdown de 208 px sur une cible de 144 px n'est pas équivalent touch-friendly sans positionnement adaptatif.

**Correction minimum** : ajouter `left-auto right-0` avec un `max-w-[min(208px,90vw)]` ou ajouter une détection d'overflow pour inverser l'ancrage.

---

### 🟡 P4 — Test trompeur : "dismissed item absent from subsequent GET"

**Fichier** : `viewing-progress.test.ts`, ligne 387

```typescript
it('dismissed item is absent from subsequent GET /continue-watching', async () => {
  // After dismissal the DB leftJoin filters it out — simulate empty result
  setupContinueWatchingSelect([])
  const res = await app.inject({ method: 'GET', url: '/continue-watching' })
  expect(res.json()).toEqual([])
})
```

Ce test n'appelle pas DELETE. Il configure directement le mock pour retourner une liste vide. Le titre suggère une séquence causale (dismiss → GET vide) qui n'existe pas dans le test.

**Correction** : soit reformuler le titre pour refléter ce qui est réellement testé ("GET returns empty when leftJoin filters all items"), soit effectuer un appel DELETE réel avant le GET.

---

## Risques éventuels

- **Seek sans clamp (mineur)** : `PlayerPage.tsx` ligne 531 fait `video.currentTime = startPositionSeconds` sans vérifier le range seekable. Le ticket demande un fallback récupérable si la position sauvegardée ne peut pas être atteinte. Ce comportement est partagé avec le chemin non-CW, donc pré-existant, mais il reste une dette technique signalée.

- **`seriesId` null pour un épisode orphelin** : si `ep.seriesId` est null (cas de données inconsistantes), le bouton ⓘ de la carte épisode fait `navigate('/series/null', ...)` ou ne navigue pas — pas testé ni défensif.

- **`request.profileId!` dans les tests** : les tests injectent les routes sans plugin d'auth, donc `request.profileId` est `undefined` au runtime des tests. Les mocks DB absorbent ça silencieusement. Ce n'est pas un régressif T095 mais c'est un angle mort de la suite de tests.

---

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES**

---

## Actions demandées

1. **(Bloquant)** Corriger le bug de feedback d'erreur lors du rollback optimistic : déplacer la gestion d'erreur du composant vers le hook ou `ContinueWatchingRow`, afin que l'erreur survive au remontage de la carte.

2. **(Bloquant)** Ajouter la navigation clavier dans `ContinueWatchingOverflowMenu` : focus sur le premier item à l'ouverture, Arrow Up/Down entre les items. Sans ça, le critère d'accessibilité §10 du ticket n'est pas satisfait.

3. **(Significatif)** Corriger le positionnement du menu pour éviter le débordement viewport, ou implémenter un bottom sheet pour mobile.

4. **(Mineur)** Corriger ou renommer le test "dismissed item is absent from subsequent GET" pour qu'il reflète fidèlement ce qu'il teste.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T095/reviews/implementation-review.md
- generated at: 2026-08-18T13:21:12Z

---

I have enough information to write the full review.

---

# PR Review — T095: Improve Continue Watching cards with direct resume, details and overflow actions

## Résumé

L'implémentation couvre correctement le schéma de persistance des dismissals, l'enrichissement des données d'épisode, la navigation depuis le player, et la logique de ré-entrée après nouvelle lecture. Deux problèmes bloquants ont été identifiés : un bug de feedback utilisateur perdu lors d'un rollback d'optimistic UI, et une lacune d'accessibilité clavier dans le menu déroulant que le ticket impose explicitement (§10).

---

## Vérifications effectuées

- Ticket T095 (§1–§10 + critères d'acceptation)
- Plan (`runs/T095/plan.md`)
- Schema + migration : `continue-watching-dismissals.ts`, `0042_t095_continue_watching_dismissals.sql`
- Service : `viewing-progress-service.ts` (upsertProgress, dismissContinueWatching, listContinueWatching)
- Routes : `viewing-progress.ts`
- Contracts : `user-state.ts`
- Hook : `useContinueWatching.ts`
- Composants : `ContinueWatchingCard.tsx`, `ContinueWatchingOverflowMenu.tsx`, `ContinueWatchingRow.tsx`
- PlayerPage : flag `skipResumeDialog`
- Tests backend : `viewing-progress.test.ts`
- Tests frontend : `ContinueWatchingCard.test.tsx`, `ContinueWatchingRow.test.tsx`

---

## Points validés

**Backend**
- Table `continue_watching_dismissals` avec contrainte unique `(profileId, mediaType, mediaId)` et FK cascade sur profiles. ✓
- `listContinueWatching` : LEFT JOIN + IS NULL pour exclure les items dismissés ; filtres 5 %–90 % corrects via SQL `progressSeconds >= durationSeconds * 0.05` et `< 0.90`. ✓
- `upsertProgress` efface le dismissal dès que la progression ≥ 5 %, permettant la ré-entrée. ✓
- `dismissContinueWatching` est idempotent (`ON CONFLICT DO UPDATE`). ✓
- Isolation par épisode : le dismissal porte sur `(profileId, mediaType, mediaId)`, donc un épisode A dismissed ne retire pas l'épisode B. ✓
- L'historique de visionnage (`viewing_progress`) n'est pas détruit lors d'un dismissal. ✓
- Enrichissement épisodes : `seriesId`, `seasonNumber`, `episodeNumber`, `episodeTitle` propagés via JOIN `episodes → seasons → series`. ✓
- Movies renvoient `null` pour les quatre champs épisode. ✓

**Frontend**
- `ContinueWatchingCard` : trois zones d'interaction distinctes (Play, ⓘ, ⋮). ✓
- Progress bar : `progressSeconds / durationSeconds * 100`, stable (pas de durée bufférisée). ✓
- `?source=continue_watching` dans l'URL → `skipResumeDialog = true` → lecture directe sans dialog de choix #194. ✓
- `ⓘ` ouvre `MovieDetailPage` pour MOVIE, `SeriesDetailPage` via `seriesId` pour EPISODE. ✓
- Episode label : `S{n}E{n} · {title}` (title omis si null) ; absent pour les films. ✓
- `aria-label` corrects sur les trois boutons (`Reprendre`, `Voir les détails`, `Plus d'options`). ✓
- `aria-haspopup="menu"` et `aria-expanded` sur le trigger ⋮. ✓
- Fermeture menu sur Escape et click-outside ; retour focus au trigger. ✓
- API client : `dismissContinueWatching` → `DELETE /continue-watching/:mediaType/:mediaId`. ✓

---

## Problèmes détectés

### 🔴 P1 — Bug : feedback d'erreur perdu lors du rollback optimistic

**Fichiers** : `useContinueWatching.ts` + `ContinueWatchingCard.tsx`

`dismissItem` (hook) retire l'item de `items` **avant** d'attendre la réponse API. Le composant card est donc démonté. Si l'appel API échoue :

1. Le hook restore `previous` → le composant est remonté (nouvelle instance, `dismissError = null`).
2. Le `catch` de `handleDismiss` dans l'ancienne instance appelle `setDismissError(...)` sur un composant déjà démonté → la mise à jour est silencieusement ignorée en React 18.
3. La carte remontée affiche **aucun message d'erreur** malgré l'échec.

Le test `"shows error message when dismiss fails"` passe parce qu'il utilise un mock `onDismiss` qui ne déclenche pas le retrait optimistic — il ne teste pas le vrai flux.

**Correction** : déplacer la gestion d'erreur dans le hook plutôt que dans le composant, et passer l'erreur via une prop ou un état partagé dans `ContinueWatchingRow`.

---

### 🔴 P2 — Accessibilité : navigation clavier absente dans le menu

**Fichier** : `ContinueWatchingOverflowMenu.tsx`

Le composant utilise `role="menu"` et `role="menuitem"`, ce qui engage le pattern ARIA *Menu Button* (APG). Ce pattern impose :

- Au ouverture du menu, le focus se déplace automatiquement sur le premier `menuitem`.
- `ArrowDown` / `ArrowUp` cyclent entre les items.
- `Escape` ferme et retourne le focus au trigger.

L'implémentation gère uniquement Escape et click-outside. Le focus ne se déplace pas au premier item à l'ouverture, et les flèches ne fonctionnent pas. Les utilisateurs clavier ne peuvent pas utiliser le menu normalement sur desktop.

Ticket §10 : *"keyboard users can access all actions on desktop"* — critère d'acceptation explicite.

**Correction** : au montage du menu, déplacer le focus sur le premier bouton (`menuRef.current?.querySelector('button')?.focus()`). Ajouter un gestionnaire `keydown` sur le container qui intercepte `ArrowDown`/`ArrowUp`.

---

### 🟡 P3 — Menu déroulant : débordement viewport sur mobile

**Fichier** : `ContinueWatchingOverflowMenu.tsx`

La carte fait `w-36` (144 px). Le menu fait `w-52` (208 px) positionné `absolute right-0`. Sur les cartes en position gauche du carrousel ou sur petit écran, le menu dépasse le bord gauche du viewport. Il n'y a pas de détection de bord ni d'adaptation mobile.

Le plan prévoit un *bottom sheet* pour mobile. Le ticket §8 demande "tapping ⋮ opens a bottom sheet/action sheet **or equivalent touch-friendly menu**". Un dropdown de 208 px sur une cible de 144 px n'est pas équivalent touch-friendly sans positionnement adaptatif.

**Correction minimum** : ajouter `left-auto right-0` avec un `max-w-[min(208px,90vw)]` ou ajouter une détection d'overflow pour inverser l'ancrage.

---

### 🟡 P4 — Test trompeur : "dismissed item absent from subsequent GET"

**Fichier** : `viewing-progress.test.ts`, ligne 387

```typescript
it('dismissed item is absent from subsequent GET /continue-watching', async () => {
  // After dismissal the DB leftJoin filters it out — simulate empty result
  setupContinueWatchingSelect([])
  const res = await app.inject({ method: 'GET', url: '/continue-watching' })
  expect(res.json()).toEqual([])
})
```

Ce test n'appelle pas DELETE. Il configure directement le mock pour retourner une liste vide. Le titre suggère une séquence causale (dismiss → GET vide) qui n'existe pas dans le test.

**Correction** : soit reformuler le titre pour refléter ce qui est réellement testé ("GET returns empty when leftJoin filters all items"), soit effectuer un appel DELETE réel avant le GET.

---

## Risques éventuels

- **Seek sans clamp (mineur)** : `PlayerPage.tsx` ligne 531 fait `video.currentTime = startPositionSeconds` sans vérifier le range seekable. Le ticket demande un fallback récupérable si la position sauvegardée ne peut pas être atteinte. Ce comportement est partagé avec le chemin non-CW, donc pré-existant, mais il reste une dette technique signalée.

- **`seriesId` null pour un épisode orphelin** : si `ep.seriesId` est null (cas de données inconsistantes), le bouton ⓘ de la carte épisode fait `navigate('/series/null', ...)` ou ne navigue pas — pas testé ni défensif.

- **`request.profileId!` dans les tests** : les tests injectent les routes sans plugin d'auth, donc `request.profileId` est `undefined` au runtime des tests. Les mocks DB absorbent ça silencieusement. Ce n'est pas un régressif T095 mais c'est un angle mort de la suite de tests.

---

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES**

---

## Actions demandées

1. **(Bloquant)** Corriger le bug de feedback d'erreur lors du rollback optimistic : déplacer la gestion d'erreur du composant vers le hook ou `ContinueWatchingRow`, afin que l'erreur survive au remontage de la carte.

2. **(Bloquant)** Ajouter la navigation clavier dans `ContinueWatchingOverflowMenu` : focus sur le premier item à l'ouverture, Arrow Up/Down entre les items. Sans ça, le critère d'accessibilité §10 du ticket n'est pas satisfait.

3. **(Significatif)** Corriger le positionnement du menu pour éviter le débordement viewport, ou implémenter un bottom sheet pour mobile.

4. **(Mineur)** Corriger ou renommer le test "dismissed item is absent from subsequent GET" pour qu'il reflète fidèlement ce qu'il teste.

IMPLEMENTATION_FIX_REQUIRED