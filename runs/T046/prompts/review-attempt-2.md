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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T046 — Protect hosted IPTVFlix with single-user authentication and API access control

**Source**: GitHub Issue #95

## Description

## Objective

Protect the hosted IPTVFlix web/API deployment before real Xtream, Plex or other private source credentials are used on an Internet-accessible environment.

## Context / Problem

IPTVFlix was initially designed for local/self-hosted usage. The API is now being deployed publicly on Railway and the Web app on Vercel. Source-management, synchronization, profile and catalog mutation endpoints must not remain anonymously accessible on a public URL.

The current product does not need complex household/multi-tenant identity yet, but it does need a clean authentication boundary that future Web and Android TV clients can reuse.

## Included

- Add a simple single-user hosted authentication model appropriate to the current product stage.
- Protect sensitive API endpoints server-side; frontend state alone must never be trusted for authorization.
- Keep `/health` usable for platform health checks without exposing sensitive state.
- Provide a login/session flow usable by the Web app.
- Use secure password/token/session storage and transport practices; never commit credentials or log secrets/session tokens.
- Configure cookies/tokens correctly for the Vercel frontend + Railway API topology, including HTTPS and cross-origin implications where relevant.
- Ensure source credentials, source mutations, synchronization triggers, profile mutations and playback-related operations require authentication.
- Keep the design extensible enough for a later Android TV client without implementing full multi-user accounts now.

## Acceptance Criteria

- [ ] Anonymous users cannot read or mutate protected source/profile/catalog-management endpoints.
- [ ] `/health` remains callable by Railway/platform health checks and contains no secrets.
- [ ] The Web app has a usable login/session experience and survives refresh appropriately.
- [ ] Authentication is enforced by the backend on every protected request.
- [ ] Secrets/passwords/session tokens are not exposed in logs or API payloads.
- [ ] Hosted Vercel → Railway requests work securely over HTTPS.
- [ ] Automated tests cover unauthenticated denial, successful authentication, invalid/expired session and protected mutations.
- [ ] Architecture/docs clearly state the current single-user scope and the extension point for future TV clients.

## Excluded / Out of scope

- Multi-household accounts.
- Social/OAuth login unless the Planner finds it strictly simpler and compatible with the single-user requirement.
- Role/permission matrices.
- Android TV login UI.

## Dependencies

None functionally, but this should be completed before entering real IPTV/Plex credentials into the public hosted environment.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
