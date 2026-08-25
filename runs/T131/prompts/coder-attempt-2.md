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

## Output précédent

The implementation is complete. Let me provide the summary.

---

**Implementation complete for T131.**

## Files created (11)

| File | Purpose |
|------|---------|
| `apps/api/src/db/schema/channels.ts` | `channels` table: canonical id, name, logo, tvgId, categories, timestamps |
| `apps/api/src/db/schema/channel-sources.ts` | `channel_sources` table: FK→channels, FK→sources, providerItemId, streamUrl, matchConfidence, matchProvenance, UNIQUE(sourceId, providerItemId) |
| `apps/api/migrations/0053_t131_live_tv_channels.sql` | SQL migration for both tables |
| `apps/api/src/channels/channel-normalizer.ts` | `normalizeChannelName` (strips IPTV prefixes + quality suffixes → lowercase) + `toCanonicalDisplayName` |
| `apps/api/src/channels/category-mapper.ts` | Data-driven keyword mapping to 8 canonical categories; preserves unknowns |
| `apps/api/src/channels/source-selector.ts` | `selectPreferredSources` — sorts AVAILABLE→priority desc→lastSeenAt desc |
| `apps/api/src/services/channel-sync-service.ts` | Core dedup engine: confidence-based matching (tvgId +0.6, normalizedName +0.4, threshold 0.75), in-memory index, lifecycle marking |
| `apps/api/src/channels/__tests__/channel-normalizer.test.ts` | Unit tests for prefix/suffix stripping |
| `apps/api/src/channels/__tests__/category-mapper.test.ts` | Unit tests for all canonical categories + unknown preservation |
| `apps/api/src/services/__tests__/channel-sync-service.test.ts` | Integration tests: dedup, non-merge, multi-provider, logo, ordering, idempotence, lifecycle, provenance |
| `e2e/tests/live-tv-sync.spec.ts` | E2E: 5 raw entries → 3 canonical channels, idempotent re-sync, logo and categories |

## Files modified (13)

| File | Change |
|------|--------|
| `apps/api/src/db/schema/index.ts` | Export both new schemas |
| `apps/api/src/providers/m3u/types.ts` | Add `'live'` to kind union; add `liveChannels` to snapshot |
| `apps/api/src/providers/m3u/parser.ts` | Classify non-VOD/series entries with group-title as `'live'` |
| `apps/api/src/providers/m3u/client.ts` | Populate `liveChannels` in snapshot |
| `apps/api/src/providers/xtream/types.ts` | Add `XtreamLiveCategory`, `XtreamLiveStream`; extend snapshot |
| `apps/api/src/providers/xtream/client.ts` | Add `getLiveCategories()` and `getLiveStreams()` |
| `apps/api/src/services/sync-runs-service.ts` | Fetch live categories+streams in parallel with VOD (graceful degradation) |
| `apps/api/src/services/catalog-sync-service.ts` | Call `ChannelSyncService.syncLiveChannels` after movie/series sync; add `channelsCreated/Updated` to result counts |
| `apps/api/src/routes/channels.ts` | Full `GET /channels` + `GET /channels/:id/stream` implementation |
| `packages/api-contracts/src/channels.ts` | Replace `category?: string` with `categories: string[]`; add `ChannelStreamResponse` |
| `e2e/fixtures/m3u-server.ts` | Add `'live-channels'` mode (5 entries: 3 TF1 variants + France 2 + France 3) |
| `e2e/global-setup.ts` | Start `m3uLiveChannels` server on port 9991 |
| `e2e/fixtures/index.ts` | Add `m3uLiveChannels` to `FakeServers` type |
| `apps/api/src/providers/m3u/__tests__/parser.test.ts` | Update existing test: CNN International now correctly classifies as `'live'` not `'unclassified'` |

---

## Review

---

## PR Review — T131

**Décision : IMPLEMENTATION_FIX_REQUIRED**

### Vue d'ensemble

L'implémentation est globalement solide : schéma DB correct avec UNIQUE constraint et FK CASCADE, pipeline de déduplication par confiance bien conçu, normalisation générique sans hardcoding, routes API fonctionnelles et correctement enregistrées, tests E2E avec fixture dédiée. L'intégration Xtream et M3U est cohérente avec l'architecture existante.

### Deux tests unitaires échouent (bloquant)

**1. `normalizeChannelName('M.6')` → attendu `m.6`, reçu `m 6`**

`channel-normalizer.ts:29` — `raw.replace(/[._]/g, ' ')` remplace aussi les points, ce qui transforme `M.6` → `m 6`. Le test attend `m.6`.

Fix recommandé : changer en `replace(/_/g, ' ')` (underscores seulement), le point est souvent significatif dans un nom de chaîne (`M6`, `C+`, etc.).

**2. `normalizeChannelName('  BFM  TV  ')` → attendu `bfm  tv`, reçu `bfm tv`**

`replace(/\s+/g, ' ')` collapse tous les espaces multiples. Résultat réel : `bfm tv` (un espace). L'assertion attend `bfm  tv` (deux espaces).

Fix recommandé : corriger l'assertion du test pour `'bfm tv'`.

### Observations mineures (non bloquantes)

- **Compteur `sourcesCreated`** peut légèrement sur-compter quand `onConflictDoNothing` s'applique silencieusement — impact diagnostic uniquement.
- **M3U `providerItemId = streamUrl`** (pas de fallback vers `tvgId`) peut accumuler des sources stales si l'URL change entre syncs.
- **`GET /channels/:id/stream` retourne `{ streamUrl: '' }` en 404** — corps trompeur pour les clients frontend.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T131/reviews/implementation-review.md
- generated at: 2026-08-25T09:03:32Z

---

---

## PR Review — T131

**Décision : IMPLEMENTATION_FIX_REQUIRED**

### Vue d'ensemble

L'implémentation est globalement solide : schéma DB correct avec UNIQUE constraint et FK CASCADE, pipeline de déduplication par confiance bien conçu, normalisation générique sans hardcoding, routes API fonctionnelles et correctement enregistrées, tests E2E avec fixture dédiée. L'intégration Xtream et M3U est cohérente avec l'architecture existante.

### Deux tests unitaires échouent (bloquant)

**1. `normalizeChannelName('M.6')` → attendu `m.6`, reçu `m 6`**

`channel-normalizer.ts:29` — `raw.replace(/[._]/g, ' ')` remplace aussi les points, ce qui transforme `M.6` → `m 6`. Le test attend `m.6`.

Fix recommandé : changer en `replace(/_/g, ' ')` (underscores seulement), le point est souvent significatif dans un nom de chaîne (`M6`, `C+`, etc.).

**2. `normalizeChannelName('  BFM  TV  ')` → attendu `bfm  tv`, reçu `bfm tv`**

`replace(/\s+/g, ' ')` collapse tous les espaces multiples. Résultat réel : `bfm tv` (un espace). L'assertion attend `bfm  tv` (deux espaces).

Fix recommandé : corriger l'assertion du test pour `'bfm tv'`.

### Observations mineures (non bloquantes)

- **Compteur `sourcesCreated`** peut légèrement sur-compter quand `onConflictDoNothing` s'applique silencieusement — impact diagnostic uniquement.
- **M3U `providerItemId = streamUrl`** (pas de fallback vers `tvgId`) peut accumuler des sources stales si l'URL change entre syncs.
- **`GET /channels/:id/stream` retourne `{ streamUrl: '' }` en 404** — corps trompeur pour les clients frontend.

IMPLEMENTATION_FIX_REQUIRED