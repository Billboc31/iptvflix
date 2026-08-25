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



# T131 — Canonicalize and deduplicate Live TV channels with logos and source failover

**Source**: GitHub Issue #278

## Description

## Context

Live IPTV providers frequently expose the same logical channel several times, for example `TF1`, `TF1 HD`, `TF1 FHD`, `FR | TF1`, or duplicates from multiple providers/playlists. IPTVFlix should display **one logical channel card** while retaining multiple technical stream sources behind it.

The Live TV UI target is:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Channel cards in this UI assume clean canonical names/logos and must not show provider duplication noise.

## Goal

Introduce a canonical Live TV channel model and ingestion/deduplication pipeline so the UI consumes one `Channel` with zero or more `ChannelSource` records rather than raw provider streams.

## Domain model

Conceptually:

- `Channel`
  - canonical id
  - canonical display name
  - normalized name
  - logo
  - country/language where known
  - category/categories
  - EPG/tvg identity where known
  - favorite/history references at canonical-channel level
- `ChannelSource`
  - provider/source identity
  - source-specific name
  - stream URL/id
  - quality/resolution indicators where known
  - availability/health metadata
  - priority
  - source-specific tvg-id/logo/category metadata

Use existing ingestion entities where possible; avoid unnecessary parallel models if equivalent primitives already exist.

## Deduplication / matching

Build a generic confidence-based canonical matching strategy using available signals such as:

- normalized channel name (strip provider prefixes, HD/FHD/4K suffix noise, punctuation/spacing variants where safe);
- `tvg-id` / EPG identifiers;
- logo identity/path when useful;
- country/language;
- provider category/context;
- other reliable existing metadata.

Do **not** blindly merge on fuzzy name alone. Ambiguous matches should remain separate rather than incorrectly merging distinct regional/variant channels.

Store/debug enough match provenance/confidence internally to diagnose incorrect merges.

## Logos

Canonical channels should expose a stable usable logo.

- Prefer the strongest valid source logo when multiple sources provide one.
- Gracefully fall back to a styled initials/name placeholder when no logo exists.
- Do not block channel ingestion because artwork is missing.
- Avoid downloading/duplicating remote logo binaries unless the existing architecture already has a safe image caching strategy.

## Source selection / failover

The UI/player should request the canonical channel, then backend/domain logic selects an actual stream source.

Initial source selection should consider available metadata such as:

- known availability/health;
- configured provider/source priority;
- quality/resolution;
- stable preferred source when equivalent.

Design for automatic fallback to another `ChannelSource` if the preferred stream cannot play, without requiring the user to pick between duplicate TF1 entries manually.

Do not build an over-complex active probing infrastructure in this ticket unless infrastructure already exists; establish the model/selection seam cleanly.

## Categories

Map raw provider categories into useful canonical groups suitable for the UI reference, e.g. generalist, sport, cinema/series, news, kids, music, documentary, entertainment, international. Keep mappings configurable/data-driven and preserve unknown provider categories rather than destroying information.

## Acceptance criteria

- Live TV ingestion produces canonical channels with multiple underlying sources where duplicates are confidently identified.
- Common naming variants such as provider prefixes and quality suffixes do not create obvious duplicate cards.
- Ambiguous channels are not aggressively merged.
- Canonical channel exposes a clean display name and logo/fallback.
- Favorites/history/EPG-ready identity is designed at canonical channel level.
- A reusable source-selection function/service chooses the preferred stream and supports fallback ordering.
- API contracts expose canonical channels, not raw duplicate streams, to the Live TV frontend.
- Add automated tests covering normalization, confident duplicates, ambiguous non-merges, multiple providers, logo selection and source ordering.
- No channel-specific hardcoding for TF1/France 2/etc.; examples are illustrative only.
- No manual production DB edits.