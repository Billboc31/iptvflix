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