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


# T022 — Build unified Series season and episode availability overview across sources

**Source**: GitHub Issue #39

## Description

## Objective

Make a Series detail page clearly summarize every known Season/Episode, watch progress and availability across configured sources, so users see the complete work rather than navigating provider-specific series entries.

## Context / Problem

For Series, source fragmentation is especially confusing: Plex may contain Seasons 1–3 while IPTV contains Seasons 1–5, and individual episodes may exist in different languages/qualities. IPTVFlix should present one canonical Series hierarchy and overlay availability/progress onto it.

## Included

- Extend canonical Series detail contracts/UI to present the known Series → Season → Episode hierarchy as one coherent structure.
- For each Season, show useful aggregate availability/completeness information (for example available episode count vs known episode count) without implying completeness when metadata is unknown.
- For each Episode, expose current availability across sources and variants using canonical availability contracts.
- Integrate existing viewing-progress state so watched/in-progress/next episode status is visible where reliable.
- Clearly distinguish known-but-unavailable episodes from episodes that are simply not known in metadata.
- Allow the UI to surface the preferred availability plus alternative variants when the resolver exists, without making the Series hierarchy source-specific.
- Keep the presentation usable for partial metadata and partially matched IPTV series.

## Acceptance Criteria

- [ ] One canonical Series page shows its known Seasons and Episodes rather than duplicate provider series structures.
- [ ] A Season can show `X/Y episodes available` when the total known episode count is reliable.
- [ ] An Episode can show availability from multiple configured sources without appearing multiple times in the episode list.
- [ ] Missing availability is visibly distinct from missing/unknown episode metadata.
- [ ] Existing watched/in-progress state is reflected in the episode hierarchy.
- [ ] Partial source coverage (for example Plex S1-S3 and IPTV S1-S5) is represented correctly.
- [ ] Language/quality variants do not duplicate Episode rows.
- [ ] Automated API/frontend tests cover full, partial, multi-source and unavailable episode cases.

## Excluded / Out of scope

- Video player implementation.
- Episode release notifications.
- Automatically downloading missing episodes.
- Rebuilding the metadata matching engine.

## Dependencies

Builds on #33 and benefits from #34/#35 for variant/preferred-availability presentation. Reuses the existing rich Series details and viewing-progress foundation.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tests pass. Here's a summary of the implementation:

---

## Changes made

### `packages/api-contracts/src/catalog.ts`
- `SeasonSummary`: added `availableEpisodeCount: number`
- `EpisodeResponse`: added `watchState: 'unwatched' | 'in_progress' | 'watched' | null`

### `apps/api/src/routes/catalog.ts`
- Imported `viewingProgress` schema
- Added `computeWatchState()` helper (thresholds: <0.05 → unwatched, 0.05–0.90 → in_progress, ≥0.90 → watched)
- `GET /series/:id`: added 6th parallel query counting distinct episodes per season with an AVAILABLE episodeAvailability; maps result into `availableEpisodeCount` on each `SeasonSummary`
- `GET /series/:id/seasons/:seasonNumber/episodes`: accepts optional `profileId` query param (UUID-validated); when provided, fetches `viewingProgress` in the same `Promise.all` batch and computes `watchState` per episode

### `apps/api/src/routes/catalog.test.ts`
- Fixed existing `GET /series/:id` test to add the 6th mock call
- Added: `availableEpisodeCount` aggregation test (S1=2, S2=0)
- Added: `watchState null` when no profileId
- Added: correct `watchState` per episode (`watched`/`in_progress`/`unwatched`) when profileId provided
- Added: multi-source episode appears exactly once with both variants
- Added: UNAVAILABLE episode shows `availabilityStatus: 'UNAVAILABLE'`

### `apps/web/src/lib/api.ts`
- `getSeriesSeasonEpisodes`: accepts optional `profileId` and appends `?profileId=...` when provided

### `apps/web/src/pages/SeriesDetailPage.tsx`
- Added `DEFAULT_PROFILE_ID` constant; passes it to `SeasonAccordion`

### `apps/web/src/components/detail/SeasonAccordion.tsx`
- Added `profileId?` prop; passed to `getSeriesSeasonEpisodes`
- Season header now shows `"X / Y disponible(s)"` fraction (hidden when `episodeCount === 0`)

### `apps/web/src/components/detail/EpisodeRow.tsx`
- UNAVAILABLE episodes get `opacity-50` on the container
- `watchState: 'watched'` → `✓ Vu` indicator (`aria-label="Vu"`)
- `watchState: 'in_progress'` → `◑ En cours` indicator (`aria-label="En cours"`)
- `null`/`'unwatched'` → no indicator

### `apps/web/src/test/handlers.ts`
- `MOCK_SERIES.seasons`: added `availableEpisodeCount` to each season
- `MOCK_EPISODES`: added `watchState` to each episode

### New: `apps/web/src/components/detail/SeasonAccordion.test.tsx`
6 tests: empty seasons fallback, fraction display (2/5, 0/4), no fraction when 0 episodes, plural/singular

### New: `apps/web/src/components/detail/EpisodeRow.test.tsx`
7 tests: title/badge, watched/in_progress/null/unwatched indicators, unavailable style, null title fallback

---

## Review

---

# PR Review — T022: Unified Series Season and Episode Availability

## Résumé

L'implémentation couvre l'ensemble des critères d'acceptation du ticket. Deux problèmes medium sont détectés qui nécessitent correction avant approbation.

---

## Vérifications effectuées

Lecture complète de : `packages/api-contracts/src/catalog.ts`, `apps/api/src/routes/catalog.ts`, `catalog.test.ts`, `apps/web/src/lib/api.ts`, `SeriesDetailPage.tsx`, `SeasonAccordion.tsx`, `EpisodeRow.tsx`, `handlers.ts`, `SeasonAccordion.test.tsx`, `EpisodeRow.test.tsx`.

---

## Points validés

- **Contrat** : `SeasonSummary.availableEpisodeCount` et `EpisodeResponse.watchState` ajoutés correctement, typage strict.
- **Backend `GET /series/:id`** : 6ème requête parallèle `count(distinct episodeAvailabilities.episodeId)` groupée par `seasonNumber` — SQL correct, fallback `?? 0` pour saisons sans disponibilités.
- **Backend `GET /series/:id/seasons/:sN/episodes`** : validation UUID du `profileId`, branche ternaire sans accès DB quand absent, `computeWatchState` avec seuils conformes au plan.
- **Multi-source deduplication** : variants groupés par `episodeId`, un seul row par épisode avec `variants.length ≥ 2` — AC respecté.
- **Frontend** : `SeasonAccordion` fraction `X / Y disponible(s)`, lazy-loading avec cache, pluriel correct. `EpisodeRow` `opacity-50` + aria-labels + fallback titre.
- **Tests** : 5 nouveaux cas API + 13 cas composants couvrant tous les états prévus au plan.
- **Scope** : aucun débordement sur le resolver, le write path progress, le player ou le multi-profil UI.

---

## Problèmes détectés

### [MEDIUM] Double map redondante — `apps/api/src/routes/catalog.ts` lignes 323–345

`epVariantMap` et `epRawVariantMap` sont deux maps distinctes alimentées avec **les mêmes objets** dans la même boucle. La seule différence est le typage. Une seule map suffit. C'est ~15 lignes de bruit qui violent le skill code-quality ("garder les fonctions courtes et lisibles", "éviter la magie cachée").

**Correction** : supprimer `epRawVariantMap`, passer `epVariantMap.get(e.id) ?? []` directement à `resolveVariant()`.

---

### [MEDIUM] `DEFAULT_PROFILE_ID` hardcodé — `apps/web/src/pages/SeriesDetailPage.tsx` ligne 61

```tsx
const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
```

Le plan demande : *"Retrieve the active profile ID from the existing profile context."* L'UUID hardcodé sera envoyé dans chaque requête épisodes. Dans un contexte mono-profil actuel c'est fonctionnel, mais c'est un écart explicite du plan qui crée une dépendance silencieuse sur le profil 1.

**Correction option A** (minimal) : ne pas passer `profileId` → `watchState: null` pour tous, comportement honnête.  
**Correction option B** (conforme au plan) : appeler `getProfile()` au mount, stocker l'`id` retourné, le passer à `SeasonAccordion`.

---

## Risques éventuels

- [MINOR] Pas de test couvrant `?profileId=not-a-uuid` → 400 (la validation existe côté backend mais n'est pas testée).

---

## Décision

REQUEST_CHANGES

---

## Actions demandées

1. **`apps/api/src/routes/catalog.ts`** — Fusionner `epVariantMap` et `epRawVariantMap` en une seule map.
2. **`apps/web/src/pages/SeriesDetailPage.tsx`** — Remplacer le `DEFAULT_PROFILE_ID` hardcodé : soit `undefined` (watchState null, safe), soit récupération via `getProfile()` au mount.
3. (Non bloquant) Ajouter un test API pour `profileId` invalide → 400.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T022/reviews/implementation-review.md
- generated at: 2026-08-12T06:20:51Z

---

---

# PR Review — T022: Unified Series Season and Episode Availability

## Résumé

L'implémentation couvre l'ensemble des critères d'acceptation du ticket. Deux problèmes medium sont détectés qui nécessitent correction avant approbation.

---

## Vérifications effectuées

Lecture complète de : `packages/api-contracts/src/catalog.ts`, `apps/api/src/routes/catalog.ts`, `catalog.test.ts`, `apps/web/src/lib/api.ts`, `SeriesDetailPage.tsx`, `SeasonAccordion.tsx`, `EpisodeRow.tsx`, `handlers.ts`, `SeasonAccordion.test.tsx`, `EpisodeRow.test.tsx`.

---

## Points validés

- **Contrat** : `SeasonSummary.availableEpisodeCount` et `EpisodeResponse.watchState` ajoutés correctement, typage strict.
- **Backend `GET /series/:id`** : 6ème requête parallèle `count(distinct episodeAvailabilities.episodeId)` groupée par `seasonNumber` — SQL correct, fallback `?? 0` pour saisons sans disponibilités.
- **Backend `GET /series/:id/seasons/:sN/episodes`** : validation UUID du `profileId`, branche ternaire sans accès DB quand absent, `computeWatchState` avec seuils conformes au plan.
- **Multi-source deduplication** : variants groupés par `episodeId`, un seul row par épisode avec `variants.length ≥ 2` — AC respecté.
- **Frontend** : `SeasonAccordion` fraction `X / Y disponible(s)`, lazy-loading avec cache, pluriel correct. `EpisodeRow` `opacity-50` + aria-labels + fallback titre.
- **Tests** : 5 nouveaux cas API + 13 cas composants couvrant tous les états prévus au plan.
- **Scope** : aucun débordement sur le resolver, le write path progress, le player ou le multi-profil UI.

---

## Problèmes détectés

### [MEDIUM] Double map redondante — `apps/api/src/routes/catalog.ts` lignes 323–345

`epVariantMap` et `epRawVariantMap` sont deux maps distinctes alimentées avec **les mêmes objets** dans la même boucle. La seule différence est le typage. Une seule map suffit. C'est ~15 lignes de bruit qui violent le skill code-quality ("garder les fonctions courtes et lisibles", "éviter la magie cachée").

**Correction** : supprimer `epRawVariantMap`, passer `epVariantMap.get(e.id) ?? []` directement à `resolveVariant()`.

---

### [MEDIUM] `DEFAULT_PROFILE_ID` hardcodé — `apps/web/src/pages/SeriesDetailPage.tsx` ligne 61

```tsx
const DEFAULT_PROFILE_ID = '00000000-0000-0000-0000-000000000001'
```

Le plan demande : *"Retrieve the active profile ID from the existing profile context."* L'UUID hardcodé sera envoyé dans chaque requête épisodes. Dans un contexte mono-profil actuel c'est fonctionnel, mais c'est un écart explicite du plan qui crée une dépendance silencieuse sur le profil 1.

**Correction option A** (minimal) : ne pas passer `profileId` → `watchState: null` pour tous, comportement honnête.  
**Correction option B** (conforme au plan) : appeler `getProfile()` au mount, stocker l'`id` retourné, le passer à `SeasonAccordion`.

---

## Risques éventuels

- [MINOR] Pas de test couvrant `?profileId=not-a-uuid` → 400 (la validation existe côté backend mais n'est pas testée).

---

## Décision

REQUEST_CHANGES

---

## Actions demandées

1. **`apps/api/src/routes/catalog.ts`** — Fusionner `epVariantMap` et `epRawVariantMap` en une seule map.
2. **`apps/web/src/pages/SeriesDetailPage.tsx`** — Remplacer le `DEFAULT_PROFILE_ID` hardcodé : soit `undefined` (watchState null, safe), soit récupération via `getProfile()` au mount.
3. (Non bloquant) Ajouter un test API pour `profileId` invalide → 400.

IMPLEMENTATION_FIX_REQUIRED