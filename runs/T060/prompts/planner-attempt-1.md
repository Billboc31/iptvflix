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



# T060 — Resolve missing TMDB IDs during source sync and build canonical media identity

**Source**: GitHub Issue #122

## Description

## Objective

Make IPTVFlix capable of identifying and canonicalizing movies/series even when an IPTV/Xtream source does not provide a usable TMDB ID.

During source synchronization, IPTVFlix must use the existing title normalization and TMDB title-matching capabilities to resolve missing external IDs with an explicit confidence policy, attach provider streams as `Availability` variants to the correct canonical `Media`, and expose canonical metadata/titles to the product UI.

The desired invariant is:

> Provider items describe **availability**. They must not become the canonical identity of an artwork merely because the provider omitted an external ID.

## Context / Problem

The repository already contains important pieces of this behavior:

- title normalization / variant extraction for provider titles (language, quality, etc.);
- a `TitleMatchingService` capable of scoring TMDB candidates from normalized titles;
- a `Media + N Availability` model;
- movie detail UI with an availability/version selector.

However, these pieces are not currently connected end-to-end during Xtream synchronization.

Current observed behavior:

- deduplication during Xtream sync primarily relies on `tmdb_id` supplied by the provider;
- title normalization is used to extract variant metadata but not to establish/fuse canonical Media identity;
- title-based TMDB matching is not currently part of the normal synchronization path;
- when Xtream provides a valid TMDB ID, variants can already be grouped under one Media;
- when the provider does not provide a usable TMDB ID, equivalent streams can remain separate Media records;
- even for a correctly grouped Media, the canonical display title may remain the raw name of the first provider stream.

Observed example:

`4K-FR - Dune (2021)` is grouped with many variants when Xtream provides TMDB ID `438631`, but the Media still exposes the dirty provider title instead of the canonical enriched title. A significant part of the current provider catalogue has no usable TMDB ID, so relying exclusively on provider IDs leaves many items unresolved/duplicated.

## Included

### 1. Resolve provider identity during synchronization

For each movie/series provider item, preserve the fast/reliable external-ID path when a valid supported identifier is provided.

When no usable TMDB ID is available, the synchronization pipeline must attempt canonical resolution using the existing normalization/matching capabilities rather than immediately treating the stream as a unique Media.

Conceptual flow:

```text
Provider item
   ↓
usable TMDB ID?
   ├─ yes → resolve canonical Media by external identity
   │
   └─ no
        ↓
     normalize provider title
        ↓
     normalized title + year + media type + useful available signals
        ↓
     TitleMatchingService / TMDB candidate lookup
        ↓
     confidence policy
        ├─ confident match → canonical Media
        │                    + attach Availability
        │
        └─ uncertain/no match → local UNMATCHED Media
                              + attach Availability
                              + eligible for later retry
```

The Planner may refine the implementation, but the behavior above is required.

### 2. Safe matching and confidence policy

Matching must be conservative enough to avoid corrupting the catalogue through false merges.

Use relevant available signals such as:

- normalized title;
- release year;
- media type (`MOVIE` vs `SERIES`);
- original/alternate title where available;
- existing provider/external metadata when useful.

Requirements:

- never merge Movie and Series identities;
- year should materially influence confidence when present;
- ambiguous/low-confidence candidates must remain unmatched instead of selecting the first TMDB result;
- matching decisions should be deterministic for equivalent inputs;
- confidence thresholds/reasons should be inspectable enough to diagnose bad matches.

Do not invent a second independent matching algorithm if the existing `TitleMatchingService` can be extended/reused cleanly.

### 3. Canonical Media title and metadata ownership

Provider titles such as:

`4K-FR - Dune (2021)`

must remain provider/Availability metadata, not the canonical display identity once a canonical match is known.

After successful matching/enrichment:

- `Media.title` / API display title should use the canonical/enriched title;
- canonical year/poster/backdrop/synopsis and other enriched metadata should continue to belong to Media;
- raw provider title must remain available where needed for diagnostics, rematching and Availability information;
- language, subtitles, quality and other variant-specific properties remain Availability concerns.

This must work both when the provider supplied the TMDB ID and when IPTVFlix discovered it through title matching.

### 4. Merge equivalent provider variants under one Media

When multiple source entries resolve to the same canonical artwork, they must converge on the same Media identity and create/update separate Availability variants as appropriate.

Example:

```text
4K-FR - Dune : Deuxième partie (2024)
EN - Dune Part Two 2024 1080p
VF - Dune 2 [2160p]

              ↓ canonical matching

Dune: Part Two (2024)
  ├─ Availability: FR / 4K
  ├─ Availability: EN / 1080p
  └─ Availability: FR / 4K
```

Do not merge genuinely distinct releases merely because their normalized titles are similar.

### 5. Preserve unresolved content

Failure to identify a TMDB artwork must **not** make provider content disappear or become unusable.

An unresolved item must be representable as a local Media with:

- IPTVFlix/local identity;
- nullable/missing TMDB identity;
- an explicit unmatched/unresolved enrichment state;
- its playable Availability information;
- enough normalized/raw source information to retry matching later.

The application must remain able to expose/play unmatched provider content when its Availability itself is valid.

### 6. Retry and future enrichment

Unmatched items must remain eligible for later resolution, for example after:

- a later source sync provides better metadata;
- the metadata provider gains the artwork;
- normalization/matching improves;
- a future explicit rematch/reconciliation process is introduced.

A later successful match must be able to converge the unresolved local Media toward the canonical identity without creating avoidable duplicate user-facing cards or losing relevant Availability data.

The exact reconciliation implementation should follow the repository architecture and can be planned by the Planner.

### 7. Synchronization performance and TMDB usage

The catalogue can contain many thousands of unresolved provider items. The solution must therefore avoid an uncontrolled one-request-per-item burst against TMDB.

The plan must consider the existing architecture and introduce/reuse appropriate mechanisms such as:

- bounded concurrency;
- rate limiting;
- caching of normalized-title candidate lookups;
- reuse of previous successful matching decisions;
- avoidance of repeated matching for unchanged provider items;
- batch/background processing where appropriate.

Do not make normal synchronization fragile solely because TMDB is temporarily slow or unavailable.

### 8. Idempotency and synchronization safety

Repeated synchronization of unchanged provider data must not continuously create duplicate Media or Availability records.

Concurrent/retried sync behavior must respect the repository's existing synchronization and persistence guarantees.

Where canonicalization can race, the implementation must prevent duplicate canonical identities through appropriate database constraints/transactions/locking or equivalent architecture-consistent safeguards.

## Acceptance Criteria

- [ ] An Xtream movie with a valid provider TMDB ID continues to resolve through the direct external-ID path.
- [ ] An Xtream movie without a TMDB ID is normalized and evaluated by the title matching flow during normal synchronization.
- [ ] Series without TMDB IDs use the same canonical-resolution principle while remaining type-safe from movies.
- [ ] A confident title/year/type match persists or associates the discovered TMDB identity and attaches the provider stream as an Availability of the canonical Media.
- [ ] Multiple provider entries confidently resolving to the same artwork converge on one user-facing canonical Media with multiple Availability variants.
- [ ] Low-confidence or ambiguous TMDB results do not cause automatic false merges.
- [ ] Unmatched items remain stored, visible and playable when their source Availability is valid.
- [ ] Unmatched items retain enough information/state to be retried later.
- [ ] Once a canonical/enriched identity exists, UI-facing Media APIs expose the canonical title rather than a dirty provider title such as `4K-FR - Dune (2021)`.
- [ ] Raw provider titles remain available at the Availability/source level for diagnostics and rematching.
- [ ] Variant metadata such as language and quality remains attached to Availability rather than contaminating canonical Media identity.
- [ ] Re-running sync with unchanged data is idempotent and does not create duplicate Media/Availability records.
- [ ] The solution has a bounded strategy for TMDB calls and does not launch uncontrolled parallel requests for the entire unresolved catalogue.
- [ ] Temporary TMDB failure does not destroy/drop provider content or leave the synchronization in an inconsistent state.
- [ ] Automated tests cover direct-ID matching, successful title matching, ambiguous matching, no match, different years with similar titles, Movie-vs-Series separation, multi-variant convergence, canonical-title promotion, retry/idempotency and relevant concurrency/rate-limit behavior.

## Out of scope

- Building the recommendation/taste engine.
- Building automatic shelves.
- Replacing TMDB as the metadata provider.
- Manual administrator matching UI unless required by an existing repository contract.
- Solving browser playback/codec compatibility; playback resolution is a separate concern.
- Bulk-importing the complete TMDB catalogue.

## Architecture constraints

- Preserve the core domain separation: `Media = what the artwork is`, `Availability = where/how it can be watched`.
- TMDB ID is an external identifier, not IPTVFlix's primary Media identity; local Media identity must continue to work when `tmdbId` is null.
- Reuse existing title normalization and `TitleMatchingService` capabilities rather than duplicating them without justification.
- Provider-specific/raw naming must not leak back into canonical Media identity after successful enrichment.
- Matching must prefer no automatic match over a dangerous low-confidence merge.

## Dependencies / relationship to existing work

This issue should integrate the normalization, matching, Media/Availability and enrichment capabilities already present in the repository. The Planner must inspect the current sync pipeline and existing matching services before proposing new abstractions.

It is related to the current canonical Media/Availability domain evolution but should not introduce an artificial dependency on recommendation or Shelf features.