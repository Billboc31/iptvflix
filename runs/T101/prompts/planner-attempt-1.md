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



# T101 — Create standalone Recommendation Lab service and simple Web UI

**Source**: GitHub Issue #204

## Description

## Context
IPTVFlix needs a recommendation system that can be developed, queried and evaluated independently from the main product UI. We explicitly do NOT want recommendation logic buried inside the Home page or coupled to one frontend implementation.

Existing foundations:
- #201 Account -> Profile
- #203 profile-level interaction/taste data

This ticket creates the standalone LAB / SERVICE shell only. Follow-up tickets add embeddings, LLM query planning, reranking, shelf generation and Home integration.

## Goal
Create a separately deployable/queryable `recommendation-engine` plus a very small `recommendation-lab` Web UI so recommendation quality can be tested interactively before connecting it to IPTVFlix Home.

Target shape:

```text
IPTVFlix DB / catalog / profiles
          ↓
recommendation-engine
          ↑
  internal HTTP API
          ↑
recommendation-lab Web UI
```

The service should be runnable locally and deployable as a separate Railway service later.

## 1. Service boundary
Add a standalone application/package under the monorepo, e.g.:
- `apps/recommendation-engine`
- and optionally `apps/recommendation-lab`

Do not mix this into `apps/api` beyond a thin integration client later.

Define clear ownership:
- reads canonical catalog data;
- reads profile/taste/interactions when requested;
- computes/query recommendations;
- never owns playback/source credentials;
- does not become another canonical media database.

## 2. Internal API
Expose versioned internal endpoints suitable for experimentation, for example:

`POST /v1/query`

Request:
```json
{
  "text": "SF qui fait réfléchir, sombre, peu d'action, moins de 2h",
  "profileId": "optional",
  "mediaTypes": ["movie"],
  "limit": 24,
  "debug": true
}
```

Response should be designed to evolve and eventually include:
- interpreted query/plan;
- candidate IDs;
- final result IDs;
- score breakdown;
- applied filters;
- model/version metadata;
- timing metrics.

Do not expose account/provider secrets.

## 3. Recommendation Lab UI
Create a deliberately simple developer/admin Web UI, not a polished consumer UI.

Minimum screen:
- free-text query input;
- optional Profile selector/id;
- content type selector;
- limit selector;
- toggles for pipeline stages as they become available;
- Search button;
- result cards with poster/title;
- diagnostic scores/reasons;
- raw structured query/plan panel;
- timing/latency panel.

Suggested future-compatible toggles:
- LLM query expansion
- vector retrieval
- metadata filtering
- profile personalization
- hybrid reranking

If a stage is not implemented yet, show it disabled rather than faking behavior.

## 4. Comparison mode
Prepare the Lab to compare strategies side-by-side later, e.g.:
- raw text vector search;
- LLM-expanded query;
- vector + structured filters;
- full hybrid personalized ranking.

Persisting experiments is not required in this ticket but API/UI contracts should not prevent it.

## 5. Catalog access
Reuse the existing canonical catalog/database. Do not duplicate all movies/series into a new relational DB just for the Lab.

Use a repository/data-access boundary so the recommendation service can later switch between shared Postgres read access or a dedicated recommendation store without changing callers.

## 6. Profile authorization
The Lab is developer/admin tooling. If it accepts `profileId`, ensure it only reads profiles allowed by the authenticated/admin context. Do not create an insecure endpoint that lets arbitrary users inspect another account's taste/history.

## 7. Observability
Log structured, sanitized diagnostics:
- request ID;
- pipeline stage timings;
- candidate counts;
- final result count;
- failures per stage;
- model/index versions.

No raw account passwords, Xtream credentials or secret-bearing provider URLs.

## 8. Railway readiness
Provide deploy/start configuration suitable for Railway as an independent service:
- health endpoint;
- PORT binding;
- environment configuration;
- database connectivity;
- LLM/embedding provider config placeholders (not secrets committed);
- graceful startup when optional AI providers are not configured.

## Acceptance criteria
- [ ] Standalone recommendation service exists outside the main API runtime.
- [ ] Service has a health endpoint and versioned query API.
- [ ] Simple Recommendation Lab Web UI can call it.
- [ ] User can type a natural-language recommendation query and see the current baseline result path.
- [ ] Debug response can carry stage outputs/scores/version metadata.
- [ ] Pipeline stages are architected as independently switchable components.
- [ ] Catalog access reuses canonical IPTVFlix data.
- [ ] Profile access is authorization-safe.
- [ ] Local run instructions exist.
- [ ] Railway deployment config exists or is documented.
- [ ] Missing optional LLM/vector stages fail gracefully and visibly.

## Completion rule
Do not close because folders/routes exist. Run the engine + lab locally, issue at least one real query against the existing IPTVFlix catalog, render real catalog titles in the Lab, and show the diagnostic request/response path end-to-end.