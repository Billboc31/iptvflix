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



# T083 — Diagnose blank web UI after latest playback changes

**Source**: GitHub Issue #176

## Description

## Context
After the latest playback/cross-platform changes, the IPTVFlix web application now renders nothing / appears completely blank. This is a regression and currently prevents validating playback or the rest of the UI.

This ticket is primarily a DIAGNOSTIC + minimal recovery ticket: determine exactly why the web UI no longer renders, restore the application shell, and document the root cause. Do not hide the failure with a generic fallback without identifying the underlying regression.

## Goal
Restore the IPTVFlix web UI so Home/navigation/content render again, while identifying the exact commit/code path/runtime error that caused the blank screen.

## Required investigation

### 1. Reproduce the blank screen
Reproduce using the same production-like Railway deployment/configuration and also check local production build (`vite build` + production serving), not only Vite dev mode.

Record:
- deployed frontend commit SHA;
- deployed backend commit SHA if relevant;
- environment/build configuration;
- route opened;
- browser/device tested;
- whether HTML shell is returned;
- whether JS/CSS assets load successfully.

### 2. Browser diagnostics
Inspect browser console and network failures before changing code:
- uncaught JavaScript exceptions;
- React render/runtime errors;
- failed dynamic imports/chunks;
- 404/500 asset requests;
- API calls failing during application bootstrap;
- CORS/mixed-content errors;
- invalid environment variables;
- service-worker/cache issues if applicable.

Capture the FIRST exception/error that prevents rendering, including stack trace and component/module involved.

### 3. Check latest playback integration
The regression appeared after substantial playback compatibility/HLS work. Explicitly inspect whether recent playback changes introduced code that executes during global app initialization even when no player is open, for example:
- HLS/player library initialization;
- browser capability detection;
- imports incompatible with SSR/build/browser target;
- missing dependency/package;
- top-level access to unavailable browser APIs;
- malformed API client configuration;
- provider/context initialization;
- routing changes;
- hook errors;
- global playback session state.

Playback code should not be capable of crashing the entire browsing UI merely because media playback is unavailable.

### 4. Verify frontend production build
Run the actual workspace production checks and capture results:
- dependency install consistency / lockfile;
- TypeScript check;
- lint where configured;
- tests;
- Vite production build;
- production bundle serving.

A successful compile alone is not enough: load the built application in a browser and verify it renders.

### 5. Railway deployment verification
Verify the actual Railway web service is serving the intended fresh build rather than an old/partial artifact.

Check:
- root directory/workspace command;
- build command;
- start command;
- PORT binding;
- environment variables, especially API base URL;
- deployment logs;
- asset paths/base path;
- current deployed SHA.

### 6. API bootstrap resilience
If an API endpoint used on startup is failing, the entire React tree must not become blank. Determine whether Home/Profile/Sources/etc. errors are handled. Restore a visible shell and useful error/loading states where necessary without masking the backend failure.

### 7. Bisect/regression identification
Compare the last known-good UI commit/deployment with the current deployment. Use git history/diff/bisect or focused inspection to identify the smallest change that introduced the blank screen.

Document the responsible commit/PR/file(s) when determinable.

## Minimal correction
Once root cause is confirmed, implement the smallest correct fix required to restore rendering. Do not perform an unrelated UI rewrite in this ticket.

If the root cause belongs to #174 playback work, isolate playback initialization so the rest of IPTVFlix remains usable even if playback/HLS initialization fails.

## Observability / error boundary
Ensure a future catastrophic frontend render failure is diagnosable. If not already present, add an appropriate top-level error boundary / visible fatal-error state in production so users do not receive a completely blank page and developers receive a useful sanitized error signal.

Do not expose credentials or provider URLs.

## Acceptance criteria
- [ ] Root cause of the blank UI is identified with concrete browser/build/deployment evidence.
- [ ] The first blocking runtime/build/network error is documented.
- [ ] Current deployed commit SHA/config is verified.
- [ ] Production build is loaded and tested, not merely compiled.
- [ ] Home renders again.
- [ ] Top navigation renders again.
- [ ] Films and Series browsing can be opened again.
- [ ] A playback failure cannot blank/crash the entire application shell.
- [ ] Existing #174 playback work is preserved unless it is proven to be the cause and needs correction/isolation.
- [ ] Railway serves the intended current build and assets without blocking 404/500 errors.
- [ ] Startup API failures produce a visible recoverable/error state rather than an empty page.
- [ ] A top-level diagnostic/error boundary exists or equivalent protection is demonstrated.
- [ ] Relevant regression test is added where practical.

## Completion rule
Do not mark this ticket complete simply because CI/build passes. Verify that the deployed/production-built WebApp visibly renders real UI content again.