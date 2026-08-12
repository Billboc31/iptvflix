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