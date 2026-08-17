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


# T093 — Preserve and display useful provider variant labels instead of UUID source names

**Source**: GitHub Issue #193

## Description

## Context
When a Movie or Episode has multiple playable variants/sources, the UI can currently show UUID-like identifiers instead of useful human-readable information. This makes source selection confusing.

The raw provider title often contains valuable variant information such as language, quality, codec/release tags or provider naming. Canonical catalog titles should stay clean, but useful provider variant metadata should not be thrown away.

## Goal
Keep canonical Movie/Series/Episode identity clean while preserving enough sanitized provider-origin metadata to label each availability meaningfully.

Example:

Raw Xtream names:
- `4K-FR - Dune (2021)`
- `DUNE.MULTI.1080P.BluRay`
- `Dune VOSTFR 720p`

Canonical media:
- `Dune`

Availability labels:
- `Français • 4K`
- `Multi • 1080p • Blu-ray`
- `VOSTFR • 720p`

Never display raw internal UUIDs as the primary user-facing source/variant label.

## Data model
Audit what is currently retained during Xtream/M3U/Plex ingestion.

Preserve useful fields on availability/provider-item level, potentially including:
- original provider title/name;
- normalized language tag(s);
- quality/resolution;
- container extension;
- codec where known;
- HDR/Dolby Vision when known;
- audio channels/format when known;
- release/source hint (WEB-DL, BluRay, etc.) when safely derivable;
- provider/source display name;
- provider stream/item ID internally only.

Do not reintroduce dirty provider titles as the canonical TMDB title.

## Source display names
A configured source should have a stable human-friendly display name (e.g. `IPTV Maison`, `Xtream Principal`, `Plex`) separate from internal UUID.

If current `source.name` or equivalent exists, use it. If not, add/derive an appropriate display-name field/migration while preserving IDs internally.

## Variant label builder
Create one shared availability-label formatter used by Movie details, Episode details, player quality/source menu and anywhere else variants are shown.

Priority should emphasize what helps the user choose:
1. language/audio;
2. quality/resolution;
3. HDR/codec/release info if useful;
4. source display name only when needed to distinguish otherwise identical variants.

Avoid labels like:
`3f027fd8-72d2-4e...`

Prefer:
`Français • 1080p`
or when needed:
`Français • 1080p • IPTV Maison`.

## Raw-name retention
Store the original provider item title/name for diagnostics and future parser improvements even after canonical matching.

This is particularly useful when normalization initially misses tags or when a user needs to understand why two variants differ.

Do not expose credentials/secrets embedded in provider URLs or configuration.

## Migration/backfill
Existing already-synced availabilities may lack useful preserved labels. Provide a safe backfill where possible from existing provider metadata/database fields. If some data cannot be recovered without re-sync, ensure the next source sync enriches existing availability rows rather than requiring database reset.

## Acceptance criteria
- [ ] Canonical Movie/Series titles remain TMDB-clean.
- [ ] Original provider item name is retained at provider/availability level where available.
- [ ] Internal source UUID is never the normal user-facing variant name.
- [ ] Sources have human-readable display labels.
- [ ] Variant selector clearly shows language + quality at minimum when known.
- [ ] Source name is added when needed to distinguish equivalent variants.
- [ ] Movie and Episode selectors share the same formatting logic.
- [ ] Player source/quality menu uses the same useful labels.
- [ ] Existing availability data is backfilled/enriched where feasible without DB reset.
- [ ] New syncs preserve provider-origin metadata.
- [ ] Tests cover representative dirty Xtream names and clean displayed labels.

## Completion rule
Manually inspect a real movie/episode with multiple Xtream variants. The user must be able to understand which variant to pick without seeing or interpreting a UUID.