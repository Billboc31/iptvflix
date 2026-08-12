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


# T045 — Add one-command local reset and remote-test deployment workflow

**Source**: GitHub Issue #86

## Description

## Objective

Provide a reproducible local reset/deploy workflow so the current IPTVFlix stack can be rebuilt from a clean database and tested remotely from another device over the local network or Tailscale.

## Context / Problem

The project already uses PostgreSQL through `docker-compose.yml`, Drizzle migrations, `pnpm dev` for API + Web, and the web dev server has been updated to listen beyond localhost for remote access. After several schema and catalog batches, manual cleanup/restart steps are error-prone and make end-to-end product testing harder.

We need a documented and preferably one-command workflow that starts from a clean local state, applies the current schema, launches the application, and exposes a clear remote-test URL without embedding machine-specific addresses.

## Included

- Add a safe local-development reset command/script that can:
  - stop the local stack when needed;
  - remove/reset the local PostgreSQL `pgdata` volume only with explicit reset intent;
  - start PostgreSQL;
  - apply all current Drizzle migrations to an empty database;
  - start API and Web using the existing monorepo tooling.
- Keep destructive reset behavior clearly separated from normal start/restart commands.
- Add a non-destructive start/deploy-local command for routine testing after the initial reset.
- Verify the API/Web bind configuration supports access from another device through a local/Tailscale IP while preserving the existing `/api` proxy behavior.
- Document how to determine/use the host machine's reachable IP rather than hard-coding one.
- Include basic readiness checks for PostgreSQL, API health and Web availability.
- Preserve local `.env`/secrets; database reset must not delete source code or user credential files.

## Acceptance Criteria

- [ ] A documented command can reset the local PostgreSQL data volume and recreate the schema from migrations only.
- [ ] Reset is explicitly destructive and cannot be confused with the normal local start command.
- [ ] A separate non-destructive command starts/restarts PostgreSQL + API + Web for testing.
- [ ] After reset, API health succeeds and the Web app loads against the freshly migrated database.
- [ ] The Web app can be reached from another device using the host's LAN/Tailscale IP and the configured dev port.
- [ ] `/api` calls continue to reach the local backend correctly during remote Web access.
- [ ] Scripts do not hard-code a developer-specific absolute path or IP address.
- [ ] Existing `.env` files/secrets are preserved.
- [ ] README/docs contain a concise clean-reset and remote-test procedure.

## Excluded / Out of scope

- Production hosting or cloud deployment.
- Public internet exposure/port forwarding.
- Automatically creating real Xtream/Plex credentials or sources after reset.
- Seeding a large fake media catalog unless needed only for lightweight smoke validation.

## Dependencies

Should run after the migration-chain stabilization already completed in #75. It can otherwise be developed independently of the recommendation batch.