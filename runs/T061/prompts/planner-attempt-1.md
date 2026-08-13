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

# Role — Planner

## Mission

Lire un ticket et produire un plan d’implémentation court, concret, borné et actionnable.

## Tu dois

- comprendre le ticket
- proposer les étapes minimales
- lister les fichiers à créer ou modifier
- identifier les risques
- expliciter le hors scope
- produire un plan Markdown versionnable
- signaler les hypothèses nécessaires

## Tu ne dois pas

- coder
- réécrire le ticket
- anticiper les tickets suivants
- élargir le scope
- masquer les incertitudes

## Sortie attendue

Un fichier de plan conforme à `ai/templates/plan-template.md`.

## Règles

- le plan doit rester court
- le plan doit être exécutable par un Coder sans ambiguïté
- toute hypothèse doit être explicite
- toute dérive de scope doit être refusée

## Structure obligatoire

Tout plan doit contenir au minimum **les sections suivantes** (titres
Markdown niveau 2 — `##`). Les variantes anglaises sont acceptées à l'identique :

| Français (recommandé)         | English equivalent       |
|-------------------------------|--------------------------|
| `## Contexte`                 | `## Context`             |
| `## Objectif`                 | `## Objective`           |
| `## Inclus`                   | `## Included`            |
| `## Hors scope`               | `## Excluded`            |
| `## Critères d'acceptation`   | `## Acceptance criteria` |

Choisis une langue par plan, ne mélange pas FR et EN dans un même plan.

Ces titres sont obligatoires même si une section est courte : un ticket
trivial peut produire un plan court, mais la structure doit rester stable.

Ne jamais produire uniquement un résumé.
Ne jamais produire un compte rendu d’implémentation.

## Interdictions absolues

Tu ne dois jamais écrire :
- "implémentation terminée"
- "syntaxe valide"
- "changements appliqués"
- "voici ce qui a été fait"

Tu dois produire uniquement un plan futur, pas un compte rendu passé.

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

# SKILL: architecture-discipline

# Skill — Architecture Discipline

## Objectif

Préserver la cohérence architecture du projet dans le temps.

## Règles

- respecter les invariants documentés
- éviter les couplages implicites
- éviter les dépendances inutiles
- éviter les refactors transversaux non demandés
- documenter toute nouvelle règle structurante
- privilégier les changements locaux et bornés

## Refuser si

- le scope dérive
- plusieurs couches sont modifiées sans justification
- des conventions existantes sont cassées
- la mémoire projet devient incohérente

---

# SKILL: documentation

# Skill — Documentation

## Objectif

Maintenir une documentation utile, concise et alignée avec le code réel.

## Règles

- documenter les décisions importantes
- éviter les documentations vagues
- garder la mémoire projet cohérente
- expliciter les invariants architecture
- préférer Markdown simple et versionnable

## Refuser si

- la documentation diverge du comportement réel
- la mémoire contient des suppositions non validées
- des décisions importantes ne sont pas tracées

---

# TASK

The ticket follows.
# Generic Planner Task Read the ticket below and produce a detailed implementation plan.

## Artifact-only output (strict)

Your response will be written verbatim to `runs/<ticket>/plan.md`.
Rewrite the artifact itself. Do not describe the modifications.
Do not explain what changed. Do not produce a status report.

This rule applies to both initial plans and rewrites after a review.
Examples of forbidden openings: "The plan has been rewritten…",
"This plan now covers…", "Plan rewritten as a real implementation
document…", "Key points covered…", "The document now contains…",
"Plan written to `runs/…/plan.md`…", "`runs/…/plan.md` is written…".

Do not use the Write tool on `plan.md` and then print a status summary —
your stdout IS the artifact. If you do write the file, stdout must still
be the full plan (same four headings), not a report about it.

## Required output structure (strict) Your reply **MUST** be a Markdown document containing **exactly** these four level-2 headings, in this order, spelled exactly as shown:
## Objective
## Included
## Excluded
## Acceptance criteria
These headings are mandatory even for trivial tickets. A short plan is acceptable — an unstructured plan is not. - ## Objective — one or two sentences describing what the change achieves. - ## Included — concrete changes (files, functions, logic, tests). - ## Excluded — what is explicitly out of scope for this ticket. - ## Acceptance criteria — verifiable conditions a reviewer can check. ## Invalid output Your reply is **invalid** if any of the four headings above is missing, renamed, mistyped, or replaced by a synonym (e.g. ## Goal, ## Scope, ## In scope, ## Out of scope, ## Plan, ## Tasks are **not** accepted). An invalid reply will be rejected by the automated validator and the ticket will be retried. You **MUST NOT** write: - "implementation done" - "changes applied" - "here is what was done" - any past-tense report of work already performed You produce a *future* plan, not a status report. ## Minimal valid example (for a trivial ticket)
markdown
## Objective
Rename the helper `foo()` to `bar()` in `utils.py` to align with the new
naming convention. Behaviour is preserved.

## Included
- `utils.py`: rename `foo` → `bar`, update the docstring.
- `tests/test_utils.py`: update the single import and assertion.

## Excluded
- Renaming callers in other modules (tracked in a follow-up ticket).
- Any logic change inside `foo` / `bar`.

## Acceptance criteria
- `utils.py` no longer defines `foo`.
- `pytest tests/test_utils.py` passes.
- No other file references the old name.

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