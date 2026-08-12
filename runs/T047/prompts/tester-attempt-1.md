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


# T047 — Make Railway/Vercel staging deployment reproducible and migration-safe

**Source**: GitHub Issue #96

## Description

## Objective

Turn the current manually-configured hosted environment into a reproducible staging deployment where merges to `main` reliably redeploy Web + API against PostgreSQL with safe migrations and health checks.

## Context / Problem

The Web app is being hosted on Vercel and the Fastify API + PostgreSQL on Railway. Initial deployment exposed several repository/runtime gaps: production build vs test compilation, missing production start command, platform-provided `PORT`, database wiring and migrations, and cross-origin frontend/backend configuration.

These rules should live in the repository/documentation instead of depending on one-time dashboard knowledge.

## Included

- Formalize production/staging build and start commands for the API using compiled output rather than a watch-mode dev server.
- Document/configure Railway expectations for `PORT`, `DATABASE_URL`, `CORS_ORIGIN`, `NODE_ENV` and optional TMDB configuration.
- Add a migration-safe deployment step so Drizzle migrations run before a new API version is considered ready.
- Ensure deployment fails rather than serving a partially-migrated application when required migrations fail.
- Add health/readiness behavior appropriate to Railway and PostgreSQL.
- Document the Vercel frontend environment contract, especially `VITE_API_BASE`, and production redeploy behavior after env changes.
- Keep production build compilation separate from test sources while preserving test/typecheck validation as separate quality gates.
- Add concise staging deployment documentation from a fresh Railway/Vercel setup.

## Acceptance Criteria

- [ ] A push/merge to `main` can automatically build and redeploy the Railway API and Vercel Web app after initial provider connection.
- [ ] Railway starts the compiled API with a production command, not `tsx watch`.
- [ ] The API honors Railway's injected `PORT` and binds on `0.0.0.0`.
- [ ] PostgreSQL migrations are applied automatically and deployment fails safely if migration fails.
- [ ] `/health` verifies API reachability and reports database connectivity without exposing credentials.
- [ ] Required staging environment variables are documented without hard-coded secret values or machine-specific URLs.
- [ ] Vercel can target the Railway API through `VITE_API_BASE` and CORS is configured explicitly for the deployed frontend origin.
- [ ] A clean staging setup can be reproduced from repository documentation.

## Excluded / Out of scope

- Production-grade HA/multi-region infrastructure.
- Custom domains.
- Backups/point-in-time recovery beyond what the chosen database service provides.
- Authentication itself (covered separately).

## Dependencies

Can be developed independently, but must remain compatible with the hosted authentication ticket.