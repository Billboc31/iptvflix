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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

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