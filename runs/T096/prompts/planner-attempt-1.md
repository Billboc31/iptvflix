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



# T096 — Import and sync intro/recap/outro/credits segment metadata for TV series and anime

**Source**: GitHub Issue #197

## Description

## Context
IPTVFlix already has canonical Series / Season / Episode entities and is moving toward richer playback UX such as `Passer l'intro`, `Passer le récap`, `Épisode suivant` and eventually a near-continuous anime/manga viewing mode.

There are public/community timestamp databases that can provide episode segment metadata. IntroDB exposes intro/recap/outro timestamps through a public read API keyed by IMDb ID + season + episode, and its public stats show strong anime coverage (e.g. One Piece and Bleach are among the top contributed shows). The UI also exposes a `Popular Anime` section.

This ticket should build the canonical IPTVFlix segment-metadata ingestion layer so Web and Android TV can later consume the same normalized markers.

## Goal
Create a provider-agnostic `MediaSegment` model and ingestion/sync pipeline for episodic content, initially sourcing IntroDB and designed so additional providers such as TheIntroDB / SkipMe / future fingerprint detection can be added later.

The data must work equally for live-action Series and Anime.

## 1. Canonical segment model
Add a normalized model tied to canonical Episode identity, not to an Xtream stream row.

Suggested shape:

```text
MediaSegment
- id
- episodeId
- type
- startMs
- endMs
- sourceProvider
- sourceExternalId / sourceKey
- confidence
- submissionCount (optional)
- isVerified / status where available
- sourceUpdatedAt (optional)
- createdAt
- updatedAt
```

Supported semantic types should be extensible, including at minimum:
- `RECAP`
- `INTRO`
- `OUTRO`
- `CREDITS`
- `PREVIEW`

IntroDB currently exposes intro/recap/outro; unsupported types can remain empty until another provider supplies them.

## 2. External ID resolution
IntroDB uses IMDb ID + season + episode as its canonical lookup key.

IPTVFlix catalog is TMDB-centered, so implement reliable episode/show identifier resolution:

```text
TMDB Series
   ↓
IMDb external ID
   ↓
season + episode number
   ↓
IntroDB /segments
```

Reuse existing TMDB external-ID data if present. If IMDb IDs are not currently persisted, enrich/store them in a clean reusable way rather than resolving from TMDB on every playback.

Support anime exactly like other TV series. Do not assume anime has a separate numbering model unless source metadata actually requires it.

## 3. IntroDB provider adapter
Implement a clean provider adapter for IntroDB's public read API.

Use the current `/segments?imdb_id=...&season=...&episode=...` endpoint rather than the legacy intro-only endpoint.

Map:
- intro -> `INTRO`
- recap -> `RECAP`
- outro -> `OUTRO`

Persist confidence/submission count when returned.

Treat 404/no segment as valid "no data" rather than an operational failure.

Respect fair-use/rate limits and add appropriate throttling/retry/backoff.

Do not require an API key for read-only IntroDB usage if the public API does not require one.

## 4. Anime coverage
Explicitly support Anime in this first version.

Validate the pipeline using real anime examples with public IntroDB coverage, ideally at least:
- One Piece;
- Bleach;
- another anime present in the user's TMDB catalog if available.

IntroDB public stats currently show One Piece and Bleach among the highest-submission titles, so Anime must not be deferred as a separate future architecture.

Check for potential numbering mismatches such as:
- absolute episode numbering vs season/episode;
- specials/season 0;
- split cours;
- provider season numbering differences.

Do not silently attach timestamps to the wrong canonical episode. If numbering is ambiguous, record a mismatch/skip and expose it diagnostically.

## 5. Bootstrap strategy
Investigate whether each provider legally/technically offers a downloadable dump/export and document license/terms before attempting a wholesale database copy.

Preferred strategy:
1. if an explicitly permitted bulk dump exists, support an import path;
2. otherwise sync only episodes that exist in IPTVFlix catalog;
3. cache results locally in IPTVFlix DB;
4. never hit IntroDB on every playback.

Do not scrape the public website or clone an entire third-party dataset without an explicit permitted mechanism.

## 6. Catalog-wide backfill
Provide an admin/job command capable of enriching all existing episodic canonical content:

```text
for each canonical series
  resolve IMDb ID
  for each canonical episode
    fetch available segments
    upsert MediaSegment rows
```

Requirements:
- resumable/idempotent;
- bounded concurrency;
- progress counters;
- rate limiting;
- failures do not abort entire run;
- safe retry;
- metrics for found/no-data/error.

This should be suitable for a one-time bootstrap after deployment.

## 7. On-demand enrichment
When a new Series/Episode enters IPTVFlix after the bootstrap, fetch its segments automatically without requiring another full bootstrap.

Possible trigger points:
- after TMDB canonical episode creation;
- after catalog refresh;
- first detail/playback request as a low-priority fallback.

Prefer background enrichment rather than delaying user playback.

## 8. Nightly refresh
Add a scheduled refresh strategy for already-known episodes so community corrections/new submissions eventually reach IPTVFlix.

Do not refresh every episode every night blindly if the corpus is large. Use incremental/stale-window scheduling, e.g.:
- recently added/current-season episodes more frequently;
- old stable episodes less frequently;
- no-data episodes retried on a sensible cadence.

Make cadence configurable.

## 9. Multi-provider architecture
Do not hard-code product logic around IntroDB alone.

Define an abstraction such as:

```text
SegmentProvider
  fetchEpisodeSegments(canonicalEpisode)
```

so future sources can include:
- IntroDB;
- TheIntroDB;
- SkipMe;
- self-hosted/community submissions;
- local audio/video fingerprint detection.

Store provider provenance on every segment.

## 10. Conflict/merge strategy
If multiple providers eventually return competing timestamps for the same semantic segment, do not overwrite blindly.

Design for:
- provider priority;
- confidence;
- submission count;
- near-equal timestamp clustering;
- manually curated override.

For v1 with only IntroDB, implement the schema/logic so adding a second source does not require a migration redesign.

## 11. Version/duration awareness
A canonical episode may have multiple media cuts/releases whose timings differ slightly.

Persist enough metadata so future matching can account for:
- canonical runtime;
- playable asset duration;
- source/provider variant;
- potential offset.

Do NOT yet attempt complex automatic per-release offset correction unless clearly feasible, but do not bake in the assumption that one timestamp is always frame-perfect for every provider copy.

## 12. API for clients
Expose normalized episode segment data through IPTVFlix API, for example as part of Episode detail/playback metadata or a dedicated endpoint.

Client-facing shape should be simple:

```json
{
  "episodeId": "...",
  "segments": [
    { "type": "recap", "startMs": 0, "endMs": 62000 },
    { "type": "intro", "startMs": 115000, "endMs": 178000 },
    { "type": "outro", "startMs": 1421000, "endMs": 1485000 }
  ]
}
```

Do not expose unnecessary provider internals to normal clients.

## 13. Playback integration hooks only
This ticket should make the normalized data AVAILABLE to Web and Android TV, but should not overbuild all final player UI.

Provide clean hooks/contracts for follow-up behavior:
- show `Passer le récap` when current position is inside RECAP;
- show `Passer l'intro` inside INTRO;
- near OUTRO/CREDITS show `Épisode suivant`;
- future auto-skip / Anime never-stop mode.

Do not auto-skip anything globally in this ticket unless an existing user setting already exists.

## 14. Admin/diagnostics
Provide visibility for developers/admin into segment coverage:
- total canonical episodes;
- episodes with intro;
- with recap;
- with outro;
- no-data;
- provider failures;
- identifier mismatches;
- anime coverage separately if useful.

A diagnostic lookup by Series/Episode should show source and normalized timestamps.

## 15. Tests
Add tests for:
- IntroDB response mapping;
- no-data/404;
- IMDb + season + episode lookup;
- upsert/idempotency;
- provider provenance;
- rate-limit/retry behavior;
- anime season/episode mapping;
- specials/season 0 handling;
- provider abstraction;
- API serialization.

Use real public API smoke checks only where CI-safe; otherwise use recorded fixtures and manually verify against current public API.

## Acceptance criteria
- [ ] Canonical `MediaSegment` model exists.
- [ ] Segments are attached to canonical Episode IDs, not Xtream availability IDs.
- [ ] IntroDB `/segments` provider integration works for intro/recap/outro.
- [ ] TMDB -> IMDb identifier resolution is reusable and persisted appropriately.
- [ ] Anime is supported in v1 and validated with real covered anime.
- [ ] One Piece and/or Bleach lookup successfully returns real community segment data where currently available.
- [ ] Ambiguous anime numbering does not silently attach wrong segments.
- [ ] Existing episodic catalog can be backfilled idempotently.
- [ ] New episodes can be enriched automatically.
- [ ] A sensible incremental/nightly refresh exists.
- [ ] Third-party rate limits/fair-use are respected.
- [ ] No unauthorized scraping/full-dump behavior is introduced.
- [ ] Provider abstraction allows additional segment DBs later.
- [ ] Provenance/confidence are stored.
- [ ] IPTVFlix API exposes normalized segments to Web/Android TV.
- [ ] Diagnostics show coverage/no-data/errors.
- [ ] Tests cover live-action and anime mapping cases.

## Completion rule
Do not close because the schema/provider interface exists. Validate against real public data for at least one live-action series episode and at least two Anime episodes, persist the returned segment(s) in IPTVFlix DB, and prove the normalized API returns them for the correct canonical episodes.