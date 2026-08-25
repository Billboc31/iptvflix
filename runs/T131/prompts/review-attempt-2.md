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


# T131 — Canonicalize and deduplicate Live TV channels with logos and source failover

**Source**: GitHub Issue #278

## Description

## Context

Live IPTV providers frequently expose the same logical channel several times, for example `TF1`, `TF1 HD`, `TF1 FHD`, `FR | TF1`, or duplicates from multiple providers/playlists. IPTVFlix should display **one logical channel card** while retaining multiple technical stream sources behind it.

The Live TV UI target is:

![IPTVFlix Live TV target](https://raw.githubusercontent.com/Billboc31/iptvflix/main/CFE6ED42-4D93-43D9-AC8A-1DE7B0AF4CFA.png)

Channel cards in this UI assume clean canonical names/logos and must not show provider duplication noise.

## Goal

Introduce a canonical Live TV channel model and ingestion/deduplication pipeline so the UI consumes one `Channel` with zero or more `ChannelSource` records rather than raw provider streams.

## Domain model

Conceptually:

- `Channel`
  - canonical id
  - canonical display name
  - normalized name
  - logo
  - country/language where known
  - category/categories
  - EPG/tvg identity where known
  - favorite/history references at canonical-channel level
- `ChannelSource`
  - provider/source identity
  - source-specific name
  - stream URL/id
  - quality/resolution indicators where known
  - availability/health metadata
  - priority
  - source-specific tvg-id/logo/category metadata

Use existing ingestion entities where possible; avoid unnecessary parallel models if equivalent primitives already exist.

## Deduplication / matching

Build a generic confidence-based canonical matching strategy using available signals such as:

- normalized channel name (strip provider prefixes, HD/FHD/4K suffix noise, punctuation/spacing variants where safe);
- `tvg-id` / EPG identifiers;
- logo identity/path when useful;
- country/language;
- provider category/context;
- other reliable existing metadata.

Do **not** blindly merge on fuzzy name alone. Ambiguous matches should remain separate rather than incorrectly merging distinct regional/variant channels.

Store/debug enough match provenance/confidence internally to diagnose incorrect merges.

## Logos

Canonical channels should expose a stable usable logo.

- Prefer the strongest valid source logo when multiple sources provide one.
- Gracefully fall back to a styled initials/name placeholder when no logo exists.
- Do not block channel ingestion because artwork is missing.
- Avoid downloading/duplicating remote logo binaries unless the existing architecture already has a safe image caching strategy.

## Source selection / failover

The UI/player should request the canonical channel, then backend/domain logic selects an actual stream source.

Initial source selection should consider available metadata such as:

- known availability/health;
- configured provider/source priority;
- quality/resolution;
- stable preferred source when equivalent.

Design for automatic fallback to another `ChannelSource` if the preferred stream cannot play, without requiring the user to pick between duplicate TF1 entries manually.

Do not build an over-complex active probing infrastructure in this ticket unless infrastructure already exists; establish the model/selection seam cleanly.

## Categories

Map raw provider categories into useful canonical groups suitable for the UI reference, e.g. generalist, sport, cinema/series, news, kids, music, documentary, entertainment, international. Keep mappings configurable/data-driven and preserve unknown provider categories rather than destroying information.

## Acceptance criteria

- Live TV ingestion produces canonical channels with multiple underlying sources where duplicates are confidently identified.
- Common naming variants such as provider prefixes and quality suffixes do not create obvious duplicate cards.
- Ambiguous channels are not aggressively merged.
- Canonical channel exposes a clean display name and logo/fallback.
- Favorites/history/EPG-ready identity is designed at canonical channel level.
- A reusable source-selection function/service chooses the preferred stream and supports fallback ordering.
- API contracts expose canonical channels, not raw duplicate streams, to the Live TV frontend.
- Add automated tests covering normalization, confident duplicates, ambiguous non-merges, multiple providers, logo selection and source ordering.
- No channel-specific hardcoding for TF1/France 2/etc.; examples are illustrative only.
- No manual production DB edits.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
