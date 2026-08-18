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



# T108 — Expand TMDB discovery catalog beyond current IPTV availability before recommendation embedding backfill

**Source**: GitHub Issue #211

## Description

## Context
IPTVFlix intentionally decouples **canonical catalog identity** from **playable availability**. A Movie/Series should exist in IPTVFlix even when no Xtream/Plex source currently provides a playable stream.

This is important for the product direction:
- discovery independent of IPTV;
- recommendations over the wider media universe;
- upcoming releases;
- `À surveiller` / `À ne pas rater`;
- My List before a title becomes playable;
- later notification when an existing canonical title gains an Availability;
- recommendation shelves that may be `WATCH_NOW`, `DISCOVERY`, `UPCOMING` or `UNAVAILABLE_HIGH_AFFINITY`.

#205 is about to build/has begun catalog embeddings. If this ticket lands after #205, that is still acceptable: #205 must support incremental/backfill embedding generation for the newly expanded catalog. Do NOT reset or duplicate the embedding architecture.

## Goal
Expand the canonical TMDB-backed catalog substantially beyond titles discovered through Xtream/Plex, while keeping `Availability` as a separate optional relation.

Target model:

```text
Canonical Catalog
  ├── Movie
  ├── Series
  ├── Seasons/Episodes
  ├── metadata / credits / keywords
  ├── future/upcoming titles
  └── recommendation embeddings
          │
          └── zero or more Availability rows
                 ├── Xtream
                 ├── Plex
                 └── future providers
```

A canonical title with **zero Availability rows remains a first-class discovery/recommendation entity**.

## 1. Audit current TMDB ingestion
Document the current catalog population rules:
- what is inserted during bootstrap;
- whether Movie/Series rows are created only from source matching;
- current discover/trending/popular imports;
- current pagination limits;
- whether upcoming content is stored;
- how much canonical catalog currently exists versus playable availability count.

Do not blindly add another TMDB importer if equivalent machinery already exists.

## 2. Discovery catalog policy
Define a configurable inclusion policy that gives IPTVFlix a large useful catalog without attempting to indiscriminately clone every obscure TMDB row.

Candidate feeds/signals to ingest, subject to current TMDB API capabilities/terms:
- popular Movies;
- popular TV Series;
- trending Movies/TV;
- now playing / current releases where applicable;
- upcoming Movies;
- on-the-air / upcoming/current Series;
- genre-based discovery pages;
- high-vote/high-popularity catalog pages;
- canonical titles referenced by recommendations/search/My List even if outside the bootstrap window.

Use multiple discovery dimensions so the catalog does not become only `popular this week`.

## 3. Breadth target and quality threshold
Make catalog breadth configurable.

Do not hard-code one arbitrary number, but support practical bootstrap targets such as tens of thousands of Movies/Series if API limits/runtime/storage make that reasonable.

Prefer useful discovery coverage over exhaustive garbage ingestion.

Possible configurable gates:
- minimum vote count/popularity floor for deep historical pages;
- language/region considerations;
- release date windows;
- include upcoming regardless of current availability;
- always retain titles already referenced by user state even if they later fall below import thresholds.

Do not delete canonical/user-referenced titles merely because a popularity threshold changes.

## 4. Canonical identity first
All imported TMDB titles must use the same canonical Movie/Series entities already used by Xtream matching.

When a source later contains the title:

```text
existing canonical TMDB Movie
        +
new Xtream match
        ↓
add Availability
```

Do NOT create a second duplicate Movie because it first entered through discovery and later through IPTV.

Reuse TMDB IDs as the primary external canonical match signal where available.

## 5. Rich metadata for recommendation use
Coordinate with #203/#205 so discovery titles retain enough normalized metadata for recommendation quality.

Where current catalog model supports it, bootstrap/enrich useful fields such as:
- title/original title;
- overview;
- release/first-air date;
- genres;
- runtime/episode runtime where available;
- original language;
- production countries;
- popularity;
- vote average/count;
- poster/backdrop;
- keywords/themes;
- collections/franchises;
- cast/crew/director/creators;
- networks for Series;
- external IDs;
- certification/maturity where available;
- status (`released`, `upcoming`, returning, ended, etc.).

Use staged/lazy enrichment for expensive detail endpoints rather than exploding TMDB calls during initial bootstrap.

## 6. Tiered enrichment
Separate cheap catalog discovery from expensive rich-detail enrichment.

Suggested tiers:

### Tier A — discovery seed
Enough data to create canonical identity and basic cards.

### Tier B — recommendation-enriched
Fetch details/keywords/credits/external IDs for titles likely to enter recommendation retrieval or high-value catalog segments.

### Tier C — on-demand deep enrichment
When user opens/searches/lists a less-enriched title, fill missing detail asynchronously/immediately as appropriate.

This avoids making a 50k-title bootstrap wait on multiple detail calls per title.

## 7. Search expansion
Current IPTVFlix search should remain capable of finding canonical titles not already in local DB by querying TMDB and importing them.

When a TMDB search result is selected/relevant:
- upsert canonical title;
- enrich it;
- make it immediately available to My List/recommendations;
- keep Availability empty until a provider matches.

Do not create temporary search-only objects that disappear.

## 8. Upcoming / future titles
Explicitly store upcoming titles useful for discovery.

Need enough metadata to support future shelves such as:
- `Sorties à venir pour vous`;
- `Films à ne pas rater`;
- `Séries bientôt disponibles`;
- `À surveiller`.

When release dates/status change, nightly/incremental TMDB sync should update the same canonical title.

## 9. Availability transitions
Ensure the system can efficiently detect the important transition:

```text
canonical title existed with 0 availability
             ↓
Xtream/Plex sync finds match
             ↓
Availability added
             ↓
playableNow changes false -> true
```

Emit/store enough state/event information for a future feature to notify a Profile that a watched/listed/recommended title became available.

Do not implement the full notification UX unless already in scope elsewhere.

## 10. Recommendation policy support
Expose/query catalog eligibility independently from availability so #207/#208/#210 can implement shelf modes like:
- `WATCH_NOW`: require household availability;
- `DISCOVERY`: availability optional;
- `UPCOMING`: future release/status;
- `WATCHLIST_CANDIDATE`: high profile affinity regardless of availability;
- `NEWLY_AVAILABLE`: title recently transitioned to playable.

Do not globally filter unavailable media out of Recommendation Engine candidate generation.

## 11. My List / profile state for unavailable titles
Ensure #201 profile state can reference canonical Movies/Series with no Availability.

User should be able to:
- open details;
- watch trailer/preview if metadata allows;
- add to My List;
- like/dislike where supported;
- receive recommendation/history interactions;
- later see `Lecture` automatically appear when an Availability is added.

No fake `Lecture` button when unavailable.

## 12. Bootstrap job
Provide an idempotent/resumable admin/bootstrap command/job.

Requirements:
- cursor/page progress persistence;
- bounded concurrency;
- TMDB rate-limit handling;
- retries/backoff;
- upsert, not duplicate;
- progress metrics;
- counts by Movie/Series/upcoming;
- safe resume after deployment interruption;
- can be run incrementally rather than requiring DB reset.

## 13. Incremental/nightly sync
After bootstrap, keep the discovery catalog fresh without re-downloading everything nightly.

Use sensible update groups:
- trending/current/upcoming titles refreshed frequently;
- recently changed/current Series refreshed reasonably often;
- older stable titles refreshed less frequently;
- titles in My List/recent recommendations/user interactions can receive priority refresh.

## 14. Interaction with #205 embeddings
This ticket may land before or after #205.

Required behavior either way:
- newly inserted discovery titles are eligible for embedding generation;
- enriched metadata changes invalidate/recompute embedding document when material;
- existing embeddings are NOT wiped unnecessarily;
- provide an idempotent embedding backfill trigger/queue for catalog rows missing #205 vectors.

If #205 has already completed, explicitly run/backfill embeddings for the expanded catalog and report counts.

## 15. Storage / scale diagnostics
Add diagnostics for:
- canonical Movie count;
- canonical Series count;
- Episode count;
- titles with at least one Availability;
- titles with zero Availability;
- upcoming titles;
- recommendation-enriched titles;
- titles with embeddings (when #205 exists);
- TMDB sync age/coverage.

This lets us know whether Recommendation Engine is operating on 3k IPTV titles or a true discovery catalog.

## 16. TMDB terms / image behavior
Continue respecting TMDB API attribution/cache/image requirements used by the project. Do not bulk-download unnecessary image binaries into DB unless existing architecture intentionally does so; storing TMDB image paths/metadata is preferred where appropriate.

## Tests
Cover at minimum:
- discovery import creates canonical title with zero Availability;
- later Xtream match adds Availability to same canonical title;
- rerunning bootstrap does not duplicate;
- search imports missing TMDB title canonically;
- unavailable title can be added to profile My List;
- upcoming title updates release/status;
- recommendation query can include unavailable title when policy permits;
- `WATCH_NOW` policy excludes it until Availability exists;
- newly inserted title enters embedding backlog when #205 is present.

## Acceptance criteria
- [ ] Canonical catalog is no longer limited to titles found in IPTV/Plex sources.
- [ ] Large configurable TMDB discovery bootstrap exists for Movies and Series.
- [ ] Upcoming/future content is persisted.
- [ ] Canonical titles with zero Availability are first-class objects.
- [ ] Source sync later attaches Availability without creating duplicate media.
- [ ] Search can import missing TMDB titles into canonical DB.
- [ ] Rich recommendation metadata is stored/enriched in tiers.
- [ ] Incremental sync keeps current/upcoming catalog fresh.
- [ ] My List/profile interactions work for unavailable titles.
- [ ] Recommendation Engine can distinguish discovery vs watch-now eligibility.
- [ ] #205 embeddings can be incrementally/backfilled for expanded catalog regardless of implementation order.
- [ ] Diagnostics clearly show total catalog vs playable catalog coverage.
- [ ] No DB reset is required.

## Completion rule
Do not close because one TMDB discover endpoint was called. Demonstrate a meaningful expanded canonical catalog containing real Movies/Series that have NO IPTV Availability, show one of them in normal IPTVFlix detail/My List flow, then run/trigger a source match for a previously unavailable canonical title and prove that it gains an Availability without changing/duplicating its canonical identity. If #205 already exists, prove newly imported catalog rows also receive embeddings through incremental/backfill processing.