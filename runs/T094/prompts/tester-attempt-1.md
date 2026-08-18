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


# T094 — Prompt to resume or restart when starting partially watched movies and episodes

**Source**: GitHub Issue #194

## Description

## Context
IPTVFlix already tracks/aims to track watch progress for Movies and Episodes. When the user clicks `Lecture` on content that has meaningful saved progress, playback should not silently start from the beginning or silently resume without asking.

## Goal
Before starting a partially watched Movie or Episode, show a clear choice:

```text
Reprendre la lecture ?

Vous vous êtes arrêté à 42:18.

[ Reprendre à 42:18 ]   [ Recommencer ]
```

The same behavior must work for Movies and individual Series Episodes.

## Trigger rules
Show the resume choice only when saved progress is meaningful.

Suggested semantics:
- no prompt for content never started;
- no prompt for only a few seconds/minimal accidental playback;
- prompt when saved position is above a configurable small threshold (for example ~60–120 seconds or a small %);
- do not offer resume when content is effectively completed / very near the end;
- completed content may default to `Recommencer`, while still respecting existing watched/history semantics.

Use the TRUE media duration/progress semantics from #190. Do not base this on buffered duration or loaded range.

## UX
The choice should appear before normal playback begins, using a lightweight modal/sheet integrated with existing IPTVFlix UI.

Desktop:
- centered modal/dialog;
- keyboard accessible;
- Escape closes/cancels without starting playback.

Mobile:
- touch-friendly modal/bottom-sheet style;
- large actions;
- same two choices.

Primary action should generally be `Reprendre à HH:MM:SS` when valid progress exists.

## Movies
When user clicks `Lecture` on a Movie with saved progress:
- load saved absolute playback seconds;
- display resume timestamp;
- `Reprendre` starts playback and seeks to saved position once media is ready/seekable;
- `Recommencer` starts at 0 and should reset/replace the active resume position appropriately once playback progresses.

## Episodes
Apply the exact same behavior to the selected canonical Episode, not Series-level progress.

Example:

```text
S02E05 — Le titre
Vous vous êtes arrêté à 18:43.

[ Reprendre à 18:43 ]
[ Recommencer l'épisode ]
```

Progress from S02E04 must never trigger the prompt for S02E05.

## Interaction with source/quality selection
Resume progress belongs to the canonical Movie/Episode, not one specific availability/source.

If the user changes source/quality before playback, the selected new availability should still resume at the same canonical saved position when technically seekable.

If resume seek fails on one source, show an explicit recoverable message and allow starting from the beginning rather than silently playing from the wrong location.

## Interaction with Continue Watching
Continue Watching cards may use a direct `Reprendre` action if the intent is already explicit, but normal `Lecture` from Movie/Episode details should show the choice when meaningful progress exists.

Keep behavior consistent across Home, detail modal, Movies, Series and search results.

## Progress integrity
- read latest persisted progress before deciding whether to show prompt;
- avoid stale client-only progress when backend has newer state;
- save progress on pause/close as defined in player work;
- use absolute seconds as source of truth;
- clamp resume position against actual duration/seekable range;
- if duration changes slightly between variants, keep the absolute position when reasonable.

## Accessibility
- proper dialog semantics;
- focus initially placed on primary resume action;
- keyboard navigation between actions;
- screen-reader label includes resume timestamp.

## Acceptance criteria
- [ ] Partially watched Movie prompts `Reprendre` vs `Recommencer` before playback.
- [ ] Partially watched Episode prompts independently at episode level.
- [ ] Never-started content starts normally without unnecessary prompt.
- [ ] Trivial/accidental progress does not trigger the prompt.
- [ ] Effectively completed content does not offer a misleading resume near credits/end.
- [ ] Resume timestamp is based on saved absolute seconds and true duration semantics.
- [ ] `Reprendre` starts at the saved position.
- [ ] `Recommencer` starts at 0.
- [ ] Source/quality changes preserve canonical resume position.
- [ ] Resume from one episode never leaks to another episode.
- [ ] Desktop and mobile UX are both usable.
- [ ] Continue Watching behavior remains coherent.
- [ ] Tests cover movie/episode resume thresholds, completed content, restart and source switching.

## Completion rule
Manually validate with one real Movie and one real Episode: play each for several minutes, close, return to the detail screen, click `Lecture`, confirm the choice appears, then test BOTH `Reprendre` and `Recommencer` paths and verify the resulting playback position.