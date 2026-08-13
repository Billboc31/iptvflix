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