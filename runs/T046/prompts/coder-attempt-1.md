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