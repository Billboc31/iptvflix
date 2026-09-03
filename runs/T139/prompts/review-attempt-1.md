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


# T139 — Add mandatory New Releases shelves to Home, Movies and Series

**Source**: GitHub Issue #296

## Description

## Context

IPTVFlix's personalized recommendation shelves are intentionally optimized around each profile's tastes. This works well for relevance, but it creates an important product risk: the recommender can keep surfacing excellent older catalog titles and make the user miss major recent additions.

We need a freshness surface that is deliberately **less personalized** than the recommendation shelves.

This is not the same concept as `Nouveautés pour toi`:
- **Nouveautés** = genuinely recent catalog additions/releases, broad enough to expose important new content even when it falls outside the user's strongest known tastes.
- **Nouveautés pour toi** = recent content reranked strongly using the user's profile.

Both may coexist. `Nouveautés` must not disappear simply because the recommendation engine believes older content is a better taste match.

## Goal

Add a stable, prominent **Nouveautés / New Releases** shelf to:

1. Home — mixed movies + series.
2. Movies page — movie-only.
3. Series page — series-only.

The purpose is to guarantee visibility of meaningful recent content and prevent personalization from becoming a freshness bubble.

## Freshness semantics

Use the best reliable metadata available to distinguish:
- actual release/first-air recency;
- recent arrival/addition to the IPTVFlix catalog.

Prefer a sensible combination where possible: a newly added 25-year-old movie should not automatically outrank a major genuinely new release solely because its provider entry was imported yesterday.

Do not hardcode specific titles.

The freshness window should be configurable/centralized rather than scattered magic numbers. Exact ranking policy can use tiers/decay rather than a single hard cutoff if that produces better results.

## Ranking philosophy

`Nouveautés` should primarily rank by:
- recency;
- catalog availability/playability;
- basic quality/popularity/confidence signals when available;
- enough diversity to avoid one franchise/category monopolizing the shelf.

Personalization may be used only as a **light tie-breaker**, not as the dominant ranking signal.

A major recent title outside the user's established tastes should still have a realistic chance of appearing.

This shelf is explicitly different from personalized exploitation/exploration shelves.

## Page behavior

### Home

Add a mixed-media `Nouveautés` shelf containing meaningful recent movies and series.

It should be positioned high enough that users are unlikely to miss it, while preserving existing Continue Watching / critical personal surfaces where appropriate.

### Movies

Add a prominent movie-only `Nouveautés` shelf.

If `Nouveautés pour toi` already exists, keep both concepts visibly distinct and avoid returning two nearly identical rails.

### Series

Add a prominent series-only `Nouveautés` shelf using first-air/recent-series metadata appropriately.

Again, `Nouveautés` and `Nouveautés pour toi` may coexist but must not collapse into duplicate rails.

## Deduplication and cross-shelf behavior

Do not globally remove a major new title from `Nouveautés` merely because it appears in another personalized shelf. Freshness visibility is the purpose of this rail.

However:
- avoid duplicates inside the `Nouveautés` shelf;
- canonicalize multi-source media as usual;
- where practical, reduce excessive duplication with an adjacent `Nouveautés pour toi` rail without weakening the core freshness guarantee.

## Cache / cost

This shelf should be cheap and deterministic from catalog metadata.

- Do not require an LLM call to generate it.
- Do not regenerate expensive recommendation state solely for this shelf.
- Reuse normal page snapshot/cache infrastructure where appropriate.
- Newly ingested catalog content should become visible according to a reasonable cache invalidation/freshness policy.

## UX

- Use the existing horizontal shelf components.
- Title should clearly communicate `Nouveautés` in the current locale.
- Preserve movie/series cards and navigation behavior already used on each page.
- Hide cleanly only when there genuinely is insufficient recent playable content; do not replace it with unrelated old catalog filler and still label it `Nouveautés`.

## Acceptance criteria

- [ ] Home contains a prominent mixed movie+series `Nouveautés` shelf.
- [ ] Movies contains a prominent movie-only `Nouveautés` shelf.
- [ ] Series contains a prominent series-only `Nouveautés` shelf.
- [ ] `Nouveautés` is driven primarily by freshness, not the user taste profile.
- [ ] Recent important content can surface even when outside the user's strongest known preferences.
- [ ] `Nouveautés` remains conceptually distinct from `Nouveautés pour toi` when both exist.
- [ ] A recently imported old catalog title does not automatically outrank genuinely recent releases solely because of import time.
- [ ] Media-type constraints are enforced at retrieval level for Movies/Series pages.
- [ ] Multi-source/canonical duplicates do not appear multiple times within the rail.
- [ ] Shelf generation requires no LLM call.
- [ ] Existing personalized shelves, exploration policy, Home snapshots and Movies/Series snapshots do not regress.
- [ ] Add tests covering mixed Home results, movie-only/series-only constraints, release-vs-import recency, low-personalization ranking, canonical deduplication and insufficient-recent-content behavior.
- [ ] No title-specific hacks and no manual production DB changes.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
