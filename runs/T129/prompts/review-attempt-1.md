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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T129 — Build personalized Series page with exploitation and discovery shelves

**Source**: GitHub Issue #273

## Description

## Context

Following the personalized Home and the Movies-page personalization work, the **Séries / Series** page should become a recommendation-first discovery surface rather than a generic catalog/category listing.

As with Movies, both the **themes surfaced to the user** and the **series ranked inside those themes** must be personalized.

The page should balance:
- **exploitation** of tastes we already understand;
- **controlled exploration / serendipity** to discover new tastes.

Initial product target: approximately **75% exploitation / 25% exploration**, without requiring a rigid exact quota on every generation.

Series discovery has additional useful signals compared with movies: commitment/episode count, completed vs ongoing status, seasons, continuation behavior and future episode-level watch history. The architecture should remain ready to use those signals as they become available.

## Goal

Build the production **Séries / Series** page as horizontal personalized series-only shelves using the existing semantic/hybrid shelf and profile architecture.

## Shelf composition

Include a useful mix such as:

- **Séries pour toi** — strongest general personalized series recommendations.
- **Nouvelles séries pour toi** — recent/new series personalized for the profile.
- Multiple dynamically selected/generated **personal thematic shelves**.
- At least one **exploration / serendipity shelf** intentionally probing an adjacent or uncertain area of taste.

Do not hardcode theme names or title lists. Theme selection must remain generic and profile-driven.

## Dynamic thematic shelves

- Generate/select themes from user taste signals rather than fixed global genres.
- Themes should rotate over time and should not all represent the same dominant taste cluster.
- Only render themes with enough strong catalog candidates.
- Keep themes stable during the freshness/snapshot period; browser refresh must not reshuffle the entire page.
- Allow different users to receive materially different themes.

## Controlled exploration / serendipity

Exploration is deliberately uncertain, **not random**.

Select themes/candidates outside the strongest known preference clusters while requiring credible positive bridges back to the user's profile, such as semantic adjacency, creator/cast affinity, secondary genres, tone, era, language, quality prior or another existing profile signal.

The intended product feeling is:

> « Ce n'est pas ce qu'on te propose d'habitude, mais on pense que ça peut te plaire. »

Future `seen / neutral / liked / disliked` and episode-completion behavior should be able to turn exploration outcomes into new profile knowledge. Structure the result metadata/contracts so this can be added without rebuilding the page architecture.

## Series-specific considerations

Where data already exists and can be reused cheaply:

- avoid recommending a series as a new discovery when the user is already actively watching it; that belongs in `Continuer à regarder` / continuation surfaces;
- preserve series → season → episode navigation and existing next-episode behavior;
- keep recommendations at **series level** for discovery shelves, not individual episodes;
- leave room for future signals such as completion/drop-off rate, episode progression and series commitment preference.

Do not implement a new watch-history system solely for this ticket if those signals are not available yet.

## Series-only constraint

Every discovery shelf on this page must enforce `series` media type at retrieval/query level where possible. Do not retrieve mixed media and filter movies only in the frontend.

## Cross-shelf diversity

- Reduce duplicate series across rails when alternatives exist.
- Avoid generating multiple themes that are semantic near-duplicates.
- Preserve strong relevance over forced uniqueness.

## Cache / token control

Reuse the snapshot/materialization principles introduced for Home/Movies:

- no LLM/theme regeneration on every page refresh;
- reusable per-profile Series discovery result;
- ~24h initial freshness is acceptable;
- stale-while-revalidate where feasible;
- repeated refreshes inside the freshness period should not repeatedly consume tokens or rerun expensive recommendation work.

Reuse shared infrastructure where sensible without coupling Series freshness unnecessarily to Home or Movies.

## UX

- Reuse the existing production horizontal shelf/rail components.
- Responsive web/mobile behavior.
- No recommendation debug scores or internal explanations in consumer UI.
- Empty rails disappear cleanly.
- A failed rail does not break the page.
- Existing series detail/playback navigation remains intact.

## Acceptance criteria

- Series page is primarily composed of personalized series-only horizontal shelves.
- Both themes and titles are personalized.
- Multiple distinct exploitation themes are generated/selected dynamically.
- At least one controlled exploration/serendipity shelf is present when enough suitable candidates exist.
- Exploration is meaningfully outside dominant known tastes but retains credible positive signals; it is not pure randomness.
- Product composition targets roughly 75% exploitation / 25% exploration.
- No movies leak into series discovery shelves.
- Active/in-progress series are not needlessly presented as fresh discovery where existing state makes that identifiable.
- Cross-shelf duplicate titles and near-duplicate themes are materially reduced.
- Normal refreshes reuse cached/materialized results without repeated expensive/LLM generation.
- Existing Home, Movies and recommendation diagnostic behavior does not regress.
- Add automated tests for series-only constraints, exploitation/exploration composition, theme diversity, cross-shelf deduplication, snapshot/cache reuse and empty/error behavior.
- No series/theme-specific hacks and no manual production DB changes.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
