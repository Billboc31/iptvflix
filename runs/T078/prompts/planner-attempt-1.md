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



# T078 — Make web playback actually play resolved Xtream streams end-to-end

**Source**: GitHub Issue #163

## Description

## Problem
Even when a Movie/Episode resolves to a playback session, clicking `Regarder` currently results in no media actually playing in the web app.

Fixing provider URL construction (#162) is necessary but not sufficient: the browser playback path itself must be proven end-to-end against real Xtream VOD constraints.

## Goal
Deliver a reliable web playback flow from UI action → availability resolution → playable media in the browser, with clear fallback/error behavior when a provider format cannot be played directly.

## End-to-end flow to implement/verify

```text
Movie/Episode detail
   ↓ Regarder
availability selection
   ↓
POST /playback/resolve/:mediaType/:mediaId
   ↓
playback session
   ↓
web player
   ↓
actual bytes/manifest fetched
   ↓
video starts
```

The ticket is complete only when a real imported Movie and a real imported Episode can be played from the web UI.

## Requirements

### 1. Inspect and wire the current UI playback action
Trace every `Lecture` / `Regarder` entry point (detail modal, hero, episode card, etc.) and ensure it reaches one shared playback flow.

Do not leave buttons that only resolve metadata or update state without mounting/starting a player.

### 2. Real web player
Provide a production-grade player surface for Movie and Episode playback.

At minimum:
- visible loading/buffering state;
- play/pause;
- seek for VOD when supported;
- volume/mute;
- fullscreen;
- current/duration display;
- clean close/back behavior;
- resume from `startPositionSeconds`;
- playback error display that is useful rather than silent.

Reuse existing player work if present rather than creating duplicate players.

### 3. Browser format compatibility
Do not assume every Xtream VOD stream is browser-native.

Handle the formats actually produced by imported availabilities (e.g. mp4, TS, HLS where applicable, mkv/other containers). The Planner must determine which can be played directly and which need a backend gateway/remux/transcode strategy.

A `.mkv` URL or MPEG-TS stream must not simply be assigned to `<video src>` and considered done if target browsers cannot reliably decode it.

### 4. Playback gateway / proxy when needed
If direct provider URLs are unsuitable because of CORS, mixed-content, credentials, Range requests, headers, container support or browser restrictions, introduce a backend playback endpoint/gateway rather than exposing fragile provider access directly to the browser.

The gateway should, as required by the chosen implementation:
- keep Xtream credentials server-side;
- support HTTP Range / seeking for VOD;
- forward appropriate content type/length/range headers;
- stream rather than buffer entire media in memory;
- handle upstream disconnect/timeouts;
- avoid logging secrets;
- allow future reuse by Send to TV/other clients where sensible.

Do not implement expensive transcoding unless it is actually required; prefer pass-through/remux where feasible.

### 5. HTTPS / mixed-content and CORS
Production web is HTTPS. Playback must work even when an Xtream provider exposes HTTP URLs.

The browser must not be expected to fetch insecure credential-bearing provider URLs directly from an HTTPS IPTVFlix page.

Resolve CORS/mixed-content issues through the backend architecture rather than documenting a browser workaround.

### 6. Credentials
Do not return permanent raw Xtream username/password URLs to the browser if a backend gateway can avoid it.

Playback responses should expose an IPTVFlix playback URL/session/token where appropriate, with provider credentials remaining server-side.

### 7. Variant switching
If the current media has FR/VO/4K/1080p/etc. alternatives, switching availability should restart/re-resolve playback through the same player without creating a separate media identity.

Show the selected variant clearly.

### 8. Progress persistence
Wire playback progress to the existing viewing-progress model:
- resume at returned start position;
- periodically persist progress without excessive requests;
- persist on pause/close/unmount where possible;
- mark completion according to existing product rules;
- keep Movie/Episode semantics correct.

### 9. Error diagnosis
Surface distinct useful categories for:
- no playable availability;
- provider unauthorized/expired credentials;
- provider 404/invalid item id;
- upstream timeout;
- unsupported media/container/codec;
- browser decode failure;
- CORS/mixed-content should be eliminated by architecture, not shown as mysterious generic failure.

Backend logs should correlate media id + availability id + source id + playback session without logging credentials/full secret URL.

### 10. Production verification
Add an explicit smoke-test/debug procedure that can verify a selected real availability in production-like conditions. Automated tests may mock provider media, but acceptance also requires proving the actual web integration path rather than only unit-testing URL strings.

## Acceptance criteria
- [ ] Clicking `Regarder` on an available Movie opens/starts the shared web player.
- [ ] Clicking an available Episode starts the same playback system.
- [ ] A real Xtream Movie plays end-to-end in the supported production browser target.
- [ ] A real Xtream Episode plays end-to-end.
- [ ] HTTPS web deployment does not depend on direct HTTP mixed-content provider requests.
- [ ] Xtream credentials are not exposed unnecessarily in browser-visible URLs/logs.
- [ ] Browser-incompatible container handling is deliberate and tested.
- [ ] Range/seek works for VOD where technically supported.
- [ ] Resume from existing viewing progress works.
- [ ] Progress is persisted during/after playback.
- [ ] Switching variants works through the same canonical media/player flow.
- [ ] Playback failures are visible and diagnosable rather than silently doing nothing.
- [ ] Hero/detail/episode Play actions all converge on the same playback implementation.
- [ ] Automated integration tests cover resolver → playback endpoint/player contract.

## Dependency
#162 should fix the correctness of Xtream Movie/Episode playback targets. This issue owns the browser/player/gateway end-to-end path and should integrate that corrected resolver rather than duplicating provider URL rules.