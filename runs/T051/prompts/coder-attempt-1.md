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


# T051 — Add automatic source synchronization and discovery refresh scheduling

**Source**: GitHub Issue #100

## Description

## Objective

Keep IPTVFlix up to date automatically so new IPTV/Plex/M3U availability and external discovery candidates appear without requiring manual synchronization from the UI.

## Context / Problem

The product promise includes noticing when followed/upcoming media becomes available on configured sources. Source synchronization, availability lifecycle, Discovery Pool refresh and generated Shelf refresh now exist, but they are primarily triggered manually or per-request. A hosted always-on backend should perform bounded periodic maintenance automatically.

## Included

- Add configurable periodic scheduling for enabled source synchronization using existing synchronization services rather than duplicating provider logic.
- Schedule Discovery Candidate Pool refresh/maintenance at an appropriate independent cadence.
- Trigger or enqueue dependent refresh work (release lifecycle / recommendation-backed Shelf refresh) only through existing boundaries where required.
- Prevent overlapping syncs for the same source and avoid duplicate work when a manual sync is already running.
- Bound concurrency across sources/providers so large Xtream libraries cannot starve the API.
- Persist enough run state/status to diagnose last success/failure and survive process restarts without assuming in-memory timers are durable truth.
- Add configuration to disable/adjust automated scheduling for local development/tests.
- Surface concise last-sync/next-or-scheduled-state information in the existing source/status UI where useful.
- Ensure one failing provider does not stop maintenance for other sources.

## Acceptance Criteria

- [ ] Enabled configured sources are synchronized automatically on a configurable cadence.
- [ ] Two scheduler ticks cannot run overlapping syncs for the same source.
- [ ] Manual and scheduled synchronization share the same locking/idempotency rules.
- [ ] Source failures are isolated, logged safely and visible without stopping other sources.
- [ ] Discovery Pool maintenance runs independently and remains bounded.
- [ ] Automatic source changes continue to feed the existing availability/release lifecycle correctly.
- [ ] Scheduling can be disabled in test/local environments.
- [ ] Restart behavior does not create an immediate unbounded duplicate storm.
- [ ] Tests cover concurrency, failure isolation, disabled scheduling and restart-safe behavior.

## Excluded / Out of scope

- Push/email/mobile notifications themselves.
- Distributed multi-instance job infrastructure unless required by the actual Railway deployment model.
- Reimplementing provider synchronization.

## Dependencies

Builds on the existing sync-run locking, availability lifecycle, Discovery Pool and Shelf refresh features. Can be developed in parallel with M3U; M3U should automatically benefit once implemented.