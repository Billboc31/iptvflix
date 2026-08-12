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


# T048 — Restore full green validation across build, typecheck and tests

**Source**: GitHub Issue #97

## Description

## Objective

Restore a trustworthy green validation baseline after the rapid multi-batch evolution of IPTVFlix, without masking genuine regressions or coupling production builds to test compilation.

## Context / Problem

Recent deployment work exposed stale TypeScript test helpers and test fixtures that no longer reflect the current provider/domain model (for example sources that now include XTREAM, M3U and PLEX). Some test artifacts have reported failures while AI Dev Factory still reached TEST_COMPLETE for ticket-scoped work.

Production build should compile production code only, while the repository's explicit typecheck/test gates must independently validate all maintained tests.

## Included

- Run the complete root/API/Web validation commands on current `main` and inventory every failure.
- For each failing test/type error, determine whether it represents a product regression or a stale expectation/type fixture.
- Update stale tests/helpers to reflect the current canonical/provider-independent model rather than weakening assertions indiscriminately.
- Fix genuine implementation regressions discovered by the full suite when they are small and directly related to the failing behavior.
- Ensure API production build excludes test-only source files through a dedicated build configuration, while test/typecheck commands still validate tests intentionally.
- Remove or replace brittle generated-cache-based signals as a source of truth.
- Document/standardize the commands that AI Dev Factory and CI should use for full validation.

## Acceptance Criteria

- [ ] Root production build is green on a clean checkout.
- [ ] API and Web typecheck commands are green with maintained test sources included where intended.
- [ ] Full automated test suite is green on current `main` or any intentionally environment-dependent tests are explicitly isolated with documented requirements.
- [ ] PLEX/M3U/XTREAM test fixtures use correct shared source typing rather than XTREAM-only helper inference.
- [ ] Existing title-matching/catalog-sync failures are either fixed as regressions or updated with justified current expectations.
- [ ] No test is deleted or skipped merely to make CI green without documented justification.
- [ ] AI Dev Factory/CI has a clear full-validation command whose non-zero exit code cannot be mistaken for TEST_COMPLETE.

## Excluded / Out of scope

- New product features.
- Large refactors unrelated to failing validation.
- Replacing the entire test framework.

## Dependencies

None. Can run in parallel with product work, but should finish before treating the next hosted release as stable.