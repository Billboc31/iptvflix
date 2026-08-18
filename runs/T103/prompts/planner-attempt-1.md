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



# T103 — Add LLM query planner to expand natural-language shelf intents into structured recommendation plans

**Source**: GitHub Issue #206

## Description

## Context
#204 provides the Recommendation Lab/service and #205 provides semantic vector retrieval. We now want the LLM to act as an INTENT PLANNER, not as the source of truth for which movies exist.

A user or future shelf generator may provide a short intent such as:
`SF qui fait réfléchir`

The LLM should turn that into a richer structured QueryPlan that can drive vector retrieval, structured filters and reranking.

## Goal
Implement an optional, provider-abstracted LLM Query Planner that converts a natural-language recommendation request into a validated structured plan.

Example:
```text
Input:
SF qui fait réfléchir, plutôt sombre, peu d'action, moins de 2h

Output QueryPlan:
- displayTitle: SF qui fait réfléchir
- semanticIntent: cerebral philosophical science fiction exploring AI, identity, consciousness, time, humanity...
- desiredThemes: [AI, time, identity, consciousness]
- desiredTone: [serious, cerebral, atmospheric]
- avoid: [pure action, parody]
- mediaTypes: [movie]
- maxRuntimeMinutes: 120
- hardFilters: ...
- softPreferences: ...
```

## 1. Strict structured output
Define a versioned schema for `RecommendationQueryPlan` with clear separation between:
- semantic retrieval text;
- hard filters;
- soft preferences;
- negative preferences/avoidance;
- presentation/title suggestion;
- user-provided constraints vs LLM-inferred hints.

Validate LLM output. Invalid/unparseable output must gracefully fall back to the raw query.

## 2. Never let the LLM invent catalog results
The LLM must NOT return a final movie list as the authoritative recommendation result.

Its job is only to interpret/expand intent. Actual candidates come from IPTVFlix catalog through #205 + ranking.

## 3. Preserve explicit user constraints
If user explicitly says:
- `moins de 2h`;
- `uniquement films`;
- `pas d'horreur`;
- `après 2010`;
- `audio français`;
then those constraints must be represented as hard/strong constraints where applicable and must not be contradicted by inferred preferences.

## 4. Profile-aware optional context
Allow the planner to receive a compact sanitized TasteProfile summary where useful, but do not dump raw full interaction history into the LLM.

Example context:
```json
{
  "topGenres": ["science-fiction", "thriller"],
  "topThemes": ["AI", "space", "time"],
  "likedPeople": ["Denis Villeneuve"],
  "recentlyWatched": ["Dune: Part Two", "Arrival"],
  "negativeSignals": ["broad comedy"]
}
```

Planner should distinguish query intent from profile personalization; final ranking remains responsible for actual scoring.

## 5. Provider abstraction and versioning
Support swappable LLM providers/models with configuration, model version and prompt/schema version recorded in debug output.

Do not couple service logic to one vendor SDK throughout the codebase.

## 6. Prompt safety/cost
Use compact prompts and bounded context. Do not send provider credentials, raw account secrets or unnecessary private history.

Cache identical/sufficiently stable plan generation where useful to avoid repeated cost for the same shelf intent.

## 7. Lab toggles and visibility
In Recommendation Lab add:
- `LLM query expansion` toggle;
- raw input;
- generated QueryPlan JSON;
- semantic text actually sent to embedding retrieval;
- hard filters;
- soft preferences;
- model/prompt version;
- latency/cost metadata where available.

## 8. A/B comparison
Support comparing at minimum:
A. raw query -> embedding
B. LLM-expanded semantic intent -> embedding
C. LLM-expanded + structured constraints

For benchmark queries from #205, report whether expansion qualitatively improves result relevance.

## 9. Determinism and fallback
Use low-variance settings suitable for structured planning. On provider timeout/error:
- do not fail whole recommendation request;
- fall back to deterministic raw-query plan;
- mark `plannerFallback=true` in debug diagnostics.

## 10. Tests
Cover:
- French natural-language input;
- English input;
- explicit runtime filter;
- negative preference (`pas d'horreur`);
- mixed hard + soft constraints;
- malformed LLM response;
- provider timeout;
- prompt-injection-like user text cannot alter server/tool policy or expose secrets;
- stable schema versioning.

## Acceptance criteria
- [ ] Natural-language query can be converted into validated QueryPlan.
- [ ] QueryPlan separates semantic text, hard filters, soft preferences and avoid signals.
- [ ] Explicit user constraints are preserved.
- [ ] LLM never becomes authoritative source of catalog titles.
- [ ] Optional TasteProfile context is compact/sanitized.
- [ ] Provider/model/prompt versions are observable.
- [ ] Failure falls back to raw query without breaking search.
- [ ] Recommendation Lab displays and compares raw vs expanded retrieval.
- [ ] Real benchmark query `SF qui fait réfléchir` demonstrates a complete LLM-plan -> vector-search path.

## Completion rule
Do not close because the LLM returns JSON. Use the Lab against the real catalog and show at least several natural-language requests where the generated plan is understandable, respects constraints and feeds real retrieval results without hallucinated catalog items.