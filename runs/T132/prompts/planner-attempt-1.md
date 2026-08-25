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



# T132 — Build the Live TV dashboard UI with categories, favorites and EPG-ready cards

**Source**: GitHub Issue #279

## Description

## Context

With a standalone Live TV app and canonicalized channels, IPTVFlix needs the production Live TV dashboard itself.

## Visual target

Use this mockup as the primary UI reference:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Source: `CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png` at repository root.

The visual direction is deliberate: dark IPTVFlix shell, **orange** accent, sidebar navigation, top VOD/TV switch, strong channel logos, compact EPG information, horizontal featured rails and dense but readable all-channels list.

## Goal

Implement the Live TV consumer dashboard against canonical channel APIs, closely following the visual hierarchy of the reference screen.

## Required sections

### Top shell

- IPTVFLIX branding.
- VOD / TV switch with TV active in orange.
- Search affordance.
- Current profile/user control reuse where appropriate.

### Sidebar

Include navigation foundation for:

- Accueil TV
- Favoris
- Récemment regardées
- Guide TV
- Toutes les chaînes

And channel categories such as:

- Généralistes
- Sport
- Cinéma & Séries
- Infos
- Enfants
- Musique
- Documentaires
- Divertissement
- International

Categories must come from canonical/data-driven channel category information rather than title-specific hardcoding.

### En direct maintenant

Create a prominent horizontal rail of live channels.

Each card should support:

- channel logo;
- `LIVE` badge;
- current program name where EPG exists;
- program start/end time;
- progress indicator based on current time;
- immediate play action.

If EPG is not yet available, the card still renders cleanly with channel identity and live status.

### Recently watched

Provide a compact rail for recent canonical channels, ready to consume actual history state when available.

If no history exists yet, omit the rail rather than fabricate content.

### Channels by category

Show category shortcut cards with channel counts, following the visual reference.

### All channels

Build a dense searchable/filterable canonical channel list/grid with:

- favorite toggle;
- clean canonical logo/name;
- current/next EPG information where available;
- live progress;
- play action;
- useful filters such as favorites, HD/4K where reliable, French/international/category as data allows.

Do not display raw duplicate `ChannelSource` records to the user.

## EPG readiness

This ticket should be **EPG-ready**, even if full XMLTV/EPG ingestion lands separately.

Define UI contracts/components so `now` / `next` program information, start/end times and progress can be supplied without rewriting channel cards later.

No fake schedules should be used in production UI when EPG data is absent.

## Favorites and history readiness

- Favorite action should target canonical `Channel` identity, not a technical stream source.
- Recently watched/history should also reference canonical channels.
- If the underlying persistence already exists, wire it; otherwise establish clean frontend/domain seams rather than inventing temporary local-only behavior that will need replacement.

## Playback

- Clicking play/channel should launch the preferred stream selected by the canonical channel/source-selection layer.
- UI should not expose provider/source choice in the normal happy path.
- Surface graceful playback failure/retry/fallback behavior.

## Responsive behavior

- Desktop/tablet layout should strongly follow the reference.
- Mobile should collapse sidebar/navigation sensibly while keeping search, categories and channel cards usable.
- Design should remain compatible with future TV/remote focus navigation, even though this ticket targets the Live TV web app.

## Acceptance criteria

- Live TV dashboard visually follows the provided orange/black mockup.
- Top VOD/TV switch and Live TV sidebar are implemented.
- Live channels are shown using canonical channel identities/logos.
- Featured live rail, category shortcuts and all-channels area render from real API data.
- No duplicate provider streams appear as separate cards when canonicalization has grouped them.
- EPG-present and EPG-absent states both render cleanly.
- Favorites/history semantics are canonical-channel based.
- Search/filter works on canonical channel metadata.
- Empty/error/loading states are graceful and isolated by section where appropriate.
- Existing VOD UI is not restyled/regressed by Live TV-specific orange theme.
- Add automated/component tests for major dashboard sections, EPG/no-EPG states, canonical channel rendering, filtering and playback action wiring.
- No channel-specific hacks and no fake production EPG data.