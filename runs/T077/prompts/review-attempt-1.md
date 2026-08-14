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


# T077 — Fix Xtream VOD playback URL resolution for movies and episodes

**Source**: GitHub Issue #162

## Description

## Problem
Clicking `Regarder` currently resolves a playback session but media does not actually play.

The existing playback resolver has a concrete correctness issue for Xtream VOD:

- `buildXtreamStreamUrl()` currently always builds `/{username}/{password}/{providerItemId}.ts`.
- Movie and episode availability rows already persist `container_extension`, but `playback-resolver.ts` does not select/use it.
- Movie and episode playback need provider-specific VOD path construction rather than assuming the same path/extension for every media type.

This ticket fixes provider-side playback URL resolution first, before adding browser/player workarounds.

## Goal
Make `POST /playback/resolve/:mediaType/:mediaId` return a valid, testable Xtream playback target for canonical Movies and Episodes using the selected availability metadata.

## Requirements

### 1. Media-type-aware Xtream URL building
Build the correct Xtream VOD URL according to media type/provider semantics.

The resolver MUST distinguish:
- movie VOD;
- series episode VOD;
- future live TV (do not incorrectly reuse VOD path logic).

Do not hardcode one generic `/{user}/{pass}/{id}.ts` URL for all content.

The Planner must inspect the existing Xtream client responses and provider conventions already used by IPTVFlix and implement the correct path structure for Movies vs Episodes.

### 2. Use persisted container extension
`movie_availabilities` and `episode_availabilities` already have `container_extension`.

Include this field in playback resolution and use it when constructing the provider URL.

Examples may include `mkv`, `mp4`, `avi`, `ts`, etc. Do not silently force `.ts` when the provider exposes another extension.

If extension is absent, use a deliberate provider-specific fallback and make that fallback observable/tested.

### 3. Availability selection remains canonical
Keep the current canonical model:
- Movie/Episode identity stays canonical;
- selected availability determines provider/source/language/quality/playback reference;
- explicit availability selection must work;
- automatic variant resolution must still honor profile preferences.

### 4. Validate provider item IDs
Ensure the selected `provider_item_id` is actually the VOD/episode stream identifier expected by the Xtream endpoint, not a series/catalog id.

For Episodes, verify sync/backfill persists the correct Xtream episode stream id.

### 5. Source URL/base URL normalization
Handle provider base URLs robustly:
- trailing slash;
- http/https;
- ports;
- already-normalized base URLs.

Do not double-add path segments.

### 6. Diagnostics without leaking credentials
When playback URL construction or provider access fails, logs should identify:
- source id/type;
- media type/id;
- availability id;
- provider item id;
- container extension;
- HTTP/result category when probed.

Never log username/password or full credential-bearing playback URLs.

### 7. Test real URL construction behavior
Add unit/integration tests for at least:
- Movie Xtream URL with mp4 extension;
- Movie Xtream URL with mkv extension;
- Episode Xtream URL with provider episode id;
- missing extension fallback;
- explicit availability selection;
- disabled source / unavailable variant;
- malformed provider data.

## Acceptance criteria
- [ ] Movie playback resolver uses Movie-specific Xtream VOD URL semantics.
- [ ] Episode playback resolver uses Episode-specific Xtream VOD URL semantics.
- [ ] Persisted `container_extension` is read and used.
- [ ] Playback no longer forces `.ts` for every Xtream VOD item.
- [ ] Episode playback uses the actual episode stream/provider item id.
- [ ] Existing language/quality variant selection still works.
- [ ] Invalid/unavailable variants produce actionable errors.
- [ ] Logs do not expose Xtream credentials.
- [ ] Automated tests prove generated playback targets for Movies and Episodes.

## Current code evidence
`apps/api/src/providers/xtream/playback.ts` currently builds a generic `/{username}/{password}/{providerItemId}.ts` URL, while `apps/api/src/db/schema/availabilities.ts` already stores `container_extension`. `apps/api/src/services/playback-resolver.ts` currently ignores that field.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
