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


# T114 — Use full ProfileTaste and interaction signals in recommendation ranking

**Source**: GitHub Issue #241

## Description

## Context

IPTVFlix already persists rich per-profile behavior and builds a rich `ProfileTaste`, but the standalone recommendation-engine currently consumes only a subset of it (primarily genre scores, positive/negative media IDs and signal count).

Existing taste data includes useful signals such as:
- person/credit scores;
- keyword/theme scores;
- franchise/collection scores;
- language scores;
- country scores;
- decade scores;
- movie/series preference;
- completion rate;
- positive/negative media IDs;
- explicit feedback;
- progress/completion/watchlist history;
- profile interaction history and exposure.

## Goal

Make the standalone recommendation-engine actually use the full persisted profile behavior for planning and ranking, so user actions influence future shelves end-to-end.

## Required work

- Extend the engine taste-loading contract/schema to load the full `profile_taste` payload.
- Feed useful compact signals to the LLM Query Planner, including:
  - top genres;
  - top keywords/themes;
  - liked people/directors/actors where available;
  - franchises/collections;
  - languages/countries;
  - preferred decades;
  - movie vs series preference;
  - meaningful negative signals.
- Replace the current empty `likedPeople` planner context with real ranked people data.
- Extend hybrid reranking to use appropriate signals from:
  - genre affinity;
  - keyword/theme affinity;
  - people affinity;
  - franchise affinity;
  - language/country preference;
  - decade preference;
  - media type preference;
  - explicit positive/negative media history;
  - completion behavior;
  - exposure/repetition penalties.
- Keep weights versioned and observable in score breakdown/provenance.
- Explicit negative feedback (`DISLIKE`, `NOT_INTERESTED`) must have a stronger negative effect than merely skipping/exposure.
- Continue Watching/progress itself should not naively make every partially watched title a strong positive signal; preserve existing weighting semantics or improve them deliberately.
- Ensure episode viewing contributes to the parent series taste as intended.
- Keep all learning isolated per Profile, never per Account globally unless explicitly designed later.

## Interaction persistence audit

Audit all user-facing actions and document which canonical event/state is persisted and whether it feeds taste/ranking. At minimum cover:
- play started;
- meaningful watch progress;
- completed;
- resume;
- like;
- dislike;
- not interested;
- add/remove My List;
- search;
- shelf impression/exposure;
- item click/open detail;
- play from shelf;
- dismiss/remove from Continue Watching where applicable.

Do not invent positive taste from UI actions that do not semantically mean preference; classify each signal explicitly.

## Acceptance criteria

- [ ] Full ProfileTaste is readable by standalone recommendation-engine.
- [ ] Query Planner receives real people/theme/preference context rather than only top genres.
- [ ] Hybrid ranker consumes multiple rich taste dimensions with versioned weights.
- [ ] Explicit dislikes/not-interested materially suppress related titles.
- [ ] Profile A and Profile B with different histories produce materially different rankings for the same semantic query.
- [ ] Episode history affects the parent series taste correctly.
- [ ] Interaction persistence audit exists and gaps are fixed or tracked.
- [ ] Score breakdown explains which profile signals affected a result.
- [ ] No profile data leaks between profiles/accounts.

## Completion rule

Use at least two real profiles with different interaction histories and run the same semantic query through the live engine. Demonstrate and document materially different ranking/order and the score breakdown that caused it.