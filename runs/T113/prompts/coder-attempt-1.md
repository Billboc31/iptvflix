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

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

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

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

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

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T113 — Increase semantic retrieval pool before filtering and personalized reranking

**Source**: GitHub Issue #240

## Description

## Context

The current recommendation-engine semantic search uses the final request limit directly in the pgvector query, then applies hard filters, profile reranking and diversity on that very small set.

This makes personalization weaker than intended and can produce thin shelves after filtering.

Current shape:

`semantic query -> vector LIMIT ~20/30 -> filters -> profile rerank -> final shelf`

Target shape:

`semantic query -> vector TOP ~200 -> hard filters -> profile rerank -> diversity/exposure -> final 20/30`

## Goal

Separate **retrieval depth** from **final result limit**.

## Required work

- Add a configurable semantic retrieval pool size, default around 200 candidates per query.
- Keep the final result limit independent (for example 20-30 items for a shelf).
- Semantic retrieval must use the larger retrieval pool.
- Apply QueryPlan hard filters against the larger pool before final truncation.
- Apply profile-aware reranking, exposure penalties and diversity on the filtered pool.
- Truncate only at the very end to the requested final limit.
- Avoid pathological query sizes if many current-session media IDs are excluded; use a sane cap.
- Preserve text-search fallback behavior.
- Persist/debug both counts: retrieved candidate count and final result count.

## Unknown metadata policy

Define an explicit policy for hard filters when required metadata is missing.

Examples:
- max runtime <= 90 min but runtime unknown;
- min release year but year unknown;
- audio language constraint but language unknown.

Do not silently treat unknown values as automatically passing hard constraints. Implement and document an explicit policy such as `STRICT_EXCLUDE_UNKNOWN` for true hard filters, with any relaxed behavior clearly opt-in.

## Acceptance criteria

- [ ] `retrievalLimit` is separate from final `limit`.
- [ ] Default semantic retrieval pool is approximately 200 candidates and configurable.
- [ ] Hard filters run before final truncation.
- [ ] Profile reranking and diversity operate on the larger pool.
- [ ] Final shelf still returns only the configured 20-30 items.
- [ ] Debug/provenance exposes retrieved vs filtered vs final candidate counts.
- [ ] Unknown metadata handling for hard filters is explicit and tested.
- [ ] Real query `SF qui fait réfléchir` demonstrates that personalization can reorder/select from a pool materially larger than the final shelf.
- [ ] Regression tests cover WATCH_NOW, DISCOVERY and mixed movie/series queries.

## Completion rule

Do not close on unit tests alone. Run at least three real recommendation queries against a populated embedding index and show retrieval pool size, filtered count and final result count.