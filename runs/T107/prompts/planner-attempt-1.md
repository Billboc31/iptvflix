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



# T107 — Build infinite personalized Home shelves with cursor loading and cross-shelf deduplication

**Source**: GitHub Issue #210

## Description

## Context
Once #204-#209 provide the recommendation engine, semantic retrieval, query planning, personalized reranking, concept generation and shelf history, IPTVFlix needs to expose this as an effectively infinite Home experience.

Product direction:
- number of shelves can continue indefinitely as user scrolls;
- each shelf should stay bounded, around 20-30 titles (target 24 by default);
- load shelves in vertical batches;
- avoid loading the entire Home/catalog up front;
- avoid repeating the same titles/concepts everywhere;
- preserve fixed product shelves such as Continue Watching where appropriate.

## Goal
Implement a cursor-based Home API and Web/Mobile consumption model that can continuously deliver personalized ShelfInstances while remaining fast, deterministic within a browsing session and measurable through #209.

## 1. Home composition
Define clear shelf classes/order rules, e.g.:
- Hero/current featured content;
- Continue Watching (fixed/profile state);
- My List / recently added where product wants fixed placement;
- personalized generated shelves;
- exploration/discovery shelves;
- trending/newly available/editorial fallbacks.

Do not let LLM-generated shelves replace critical deterministic product shelves such as Continue Watching.

## 2. Cursor API
Provide cursor pagination such as:
`GET /home?cursor=...`

Response:
```json
{
  "sessionId": "...",
  "shelves": [ ... ],
  "nextCursor": "..."
}
```

A first call should establish/reuse a recommendation Home session from #209. Subsequent cursors must continue the same session so global exposure/deduplication remains coherent.

Cursor must be opaque/versioned and safe against tampering.

## 3. Batch sizing
Use configurable defaults such as:
- 5-8 shelves per vertical fetch;
- 24 items per shelf;
- hard maximum around 30 items per shelf unless a fixed shelf has specific semantics.

Do not fetch hundreds of item details/images per initial Home request.

## 4. Infinite vertical loading
Web/mobile Home should request the next batch when user approaches the bottom using IntersectionObserver/equivalent.

Requirements:
- no duplicate concurrent cursor requests;
- loading skeletons/feedback;
- retry on transient failure;
- preserve already loaded shelves;
- no full Home rerender/reset when next batch arrives;
- stop gracefully when engine intentionally has no more healthy concepts, though normal expectation is effectively continuous generation.

## 5. Horizontal shelf bounds
Each shelf receives a bounded initial item set (target 24). Do not implement unbounded horizontal item fetching by default unless a specific shelf requires it later.

Cards/images should still use existing browser lazy loading/performance practices.

## 6. Cross-shelf content deduplication
Within one Home session, use #209 exposure/session data and #207 reranking to minimize repeated media across shelves.

Rules should be configurable:
- strongly avoid duplicate title in nearby shelves;
- allow rare deliberate reappearance much farther down if relevance is exceptional;
- avoid repeated franchises/people dominating multiple adjacent shelves;
- fixed shelves (Continue Watching/My List) should influence duplicate penalties for generated shelves.

## 7. Concept deduplication/fatigue
Do not show near-identical shelf concepts repeatedly in one session or recent history.

Use #208/#209 semantic concept history/cooldown.

Examples to avoid adjacent:
- `SF sombre et cérébrale`
- `Science-fiction intelligente et sombre`

unless intentionally distinct enough in candidate set/intent.

## 8. Precompute/cache strategy
Do not make user scroll wait for an LLM call every batch.

Recommendation engine should maintain a pool/cache of validated concepts/ShelfInstances. Home API consumes ready shelves and triggers asynchronous replenishment when pool becomes low.

Provide sensible stale/fresh behavior when recommendation service is temporarily unavailable.

## 9. Profile isolation
All personalized Home state/session/cursors are scoped to current Profile.

Switching profile:
- invalidates outgoing profile's Home cursor/client shelf state;
- starts/restores appropriate incoming profile Home;
- never exposes ShelfInstances from another Profile.

## 10. Feedback instrumentation
When Home renders shelves/items, emit/associate #203/#209 visibility/exposure events correctly.

Need to distinguish:
- API returned shelf;
- shelf actually reached;
- item meaningfully visible;
- item opened/played.

## 11. Home refresh semantics
Define behavior for pull-to-refresh/manual Home refresh:
- create a fresh Home session or controlled regeneration;
- avoid immediately returning exact same shelf order if useful alternatives exist;
- do not destroy historical attribution from prior session.

## 12. Performance budget
Measure:
- initial Home TTFB;
- first meaningful shelf render;
- next-cursor latency;
- DB query count;
- recommendation service latency/cache hit rate;
- client DOM/card count after long scrolling.

Consider virtualization/windowing if DOM size becomes problematic after many shelves, but do not overcomplicate before measuring.

## 13. Fallback
If recommendation-engine is unavailable, Home must remain usable with deterministic fallback shelves from catalog/popularity/recent availability.

Continue Watching/My List should continue working independently.

## 14. Tests
Cover:
- first page + next cursors;
- same session no nearby content duplicates;
- no near-duplicate concepts;
- 24-ish item shelf cap;
- profile switch isolation;
- invalid/expired cursor;
- recommendation service outage fallback;
- repeated rapid scroll does not duplicate fetches;
- attribution IDs flow to interaction events.

## Acceptance criteria
- [ ] Home supports opaque cursor pagination of shelf batches.
- [ ] User can keep scrolling vertically and receive additional shelves.
- [ ] Shelf item count is bounded/configurable, target 24 and max ~30.
- [ ] Initial Home does not load the whole recommendation pool/catalog.
- [ ] Same Home session strongly deduplicates media across nearby shelves.
- [ ] Near-identical shelf concepts are suppressed.
- [ ] Fixed shelves coexist with generated recommendation shelves.
- [ ] Next batches normally come from precomputed/cache pool, not synchronous LLM generation.
- [ ] Profile switches cannot leak old Home shelf state.
- [ ] Shelf/item visibility and outcomes integrate with #209.
- [ ] Recommendation-engine outage has a usable fallback.
- [ ] Long scrolling remains responsive on desktop/mobile.

## Completion rule
Do not close because an infinite-scroll hook exists. Manually scroll through at least 30 generated shelves for one Profile and verify: bounded item counts, sensible concept variety, low duplicate-title rate, stable cursor behavior, attribution/history capture, and acceptable perceived loading latency.