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


# T061 — Backfill and reconcile already-synced media without TMDB identities

**Source**: GitHub Issue #123

## Description

## Objective

Reprocess the existing IPTVFlix catalog so Movies and Series that were synchronized before title-based TMDB resolution was wired into the ingestion pipeline can be matched, canonicalized and deduplicated without requiring users to delete/recreate sources or perform a destructive full reset.

## Context / Problem

Issue #122 adds the missing behavior for future source synchronization: when Xtream does not provide a usable TMDB ID, IPTVFlix should normalize the provider title, use the existing title matching service and attach the stream as an Availability of the resolved canonical Media.

However, a large catalog has already been ingested under the old behavior. Those existing records may currently have:

- no TMDB identity;
- dirty provider titles used as the Media display title;
- multiple Media rows representing different language/quality streams of the same artwork;
- Availability data that must be preserved during reconciliation.

This ticket is specifically about **backfilling existing persisted data** after #122 is available.

## Included

### Re-evaluate existing unresolved Media

- Identify existing Movies/Series that do not have a usable canonical external identity and are eligible for re-matching.
- Reuse the normalization and confidence-based matching behavior delivered by #122; do not introduce a second matching algorithm.
- Use the best available persisted source signals, including raw provider title, normalized title/year/type and source mappings.
- Process Movies and Series safely and independently.

### Canonical reconciliation

When an existing unresolved Media confidently resolves to a TMDB-backed canonical Media:

- attach/move its Availability records to the canonical Media as appropriate;
- preserve raw provider/source identifiers and variant information;
- promote canonical/enriched title/metadata for the user-facing Media;
- avoid duplicate Media cards for entries that resolve to the same artwork.

If several old Media records resolve to the same canonical identity, reconcile them into one user-facing Media while preserving all legitimate Availability variants.

### Preserve user state and references

Reconciliation must not silently lose user data. Existing references associated with superseded/merged Media must be migrated or preserved according to the repository's model, including where applicable:

- watchlist entries;
- viewing progress/history;
- feedback/likes/dislikes;
- shelf membership;
- follow/tracking state;
- other profile-scoped Media references introduced by the current schema.

The Planner must inspect current foreign keys and uniqueness constraints before choosing the merge strategy.

### Leave ambiguous content intact

- Low-confidence or ambiguous matches remain unresolved.
- Do not delete or hide an existing playable Media merely because TMDB matching fails.
- Preserve retry eligibility for unresolved records.

### Backfill execution model

Provide a safe, explicit way to run the backfill against an existing database. The exact mechanism should fit the existing architecture (job/maintenance command/admin action/startup migration is for the Planner to decide), but it must:

- be resumable/retryable;
- be idempotent;
- expose progress/results sufficiently for diagnostics;
- avoid requiring the source itself to be deleted and re-added;
- avoid blocking normal application usage for an excessive period.

### Scale and TMDB protection

The existing catalog may contain many thousands of unresolved Media records. The backfill must therefore:

- use bounded concurrency/rate limiting compatible with the TMDB integration;
- cache/reuse matching decisions where appropriate;
- avoid repeating expensive work for records already successfully reconciled;
- tolerate temporary TMDB failures and continue/retry safely;
- support partial progress without corrupting the catalog.

### Merge safety / concurrency

- Reconciliation of two or more rows toward one canonical identity must be transactionally safe.
- Database constraints/transactions/locks or equivalent safeguards must prevent duplicate canonical rows and partially migrated references.
- A failure during one Media reconciliation must not leave its Availability or user state split inconsistently across old/new identities.

## Acceptance Criteria

- [ ] Existing Movie records without TMDB IDs can be re-evaluated using the same matching policy as #122.
- [ ] Existing Series records without TMDB IDs can be re-evaluated without mixing Movie and Series identity.
- [ ] Running the backfill does not require deleting/recreating an Xtream source.
- [ ] Multiple previously separate Media records that confidently resolve to the same artwork become one user-facing canonical Media with their valid Availability variants preserved.
- [ ] Canonical/enriched title and metadata replace dirty provider titles in user-facing Media APIs after successful reconciliation.
- [ ] Raw provider titles/IDs remain available at the source/Availability level.
- [ ] Watchlist, progress/history, feedback, shelves and other existing Media references are preserved or migrated deterministically when Media identities are merged.
- [ ] Ambiguous/unmatched Media remain visible/playable and are not falsely merged.
- [ ] The backfill is idempotent: re-running it does not create duplicate Media, Availability rows or user-state references.
- [ ] The backfill is resumable/retryable after interruption or temporary TMDB failure.
- [ ] TMDB calls use bounded concurrency/rate limiting and do not create an uncontrolled burst across the unresolved catalog.
- [ ] Progress/outcome information can distinguish matched, merged, still-unmatched, skipped and failed records sufficiently for diagnostics.
- [ ] Automated tests cover existing-data matching, multi-row merge, Availability preservation, user-state migration, ambiguous match, retry/idempotency and interrupted/failed reconciliation.

## Excluded / Out of scope

- Changing the matching algorithm introduced by #122 except where a defect must be fixed to reuse it safely.
- Bulk-importing TMDB's full catalog.
- Recommendation/shelf generation logic.
- Browser playback compatibility.
- Destructive source reset as the normal solution.

## Dependencies

Requires #122's source-sync title matching/canonical-resolution behavior (or the equivalent reusable matching service) to be available first. This ticket exists to migrate/reconcile data already persisted before that behavior was active.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
