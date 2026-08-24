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

## Output précédent

Both series test files now pass completely:
- `series-pool-service.test.ts`: **11/11 tests passing** ✓
- `series-personalized.test.ts`: **9/9 tests passing** ✓

The remaining 33 failures are all pre-existing (SegmentSyncService, CanonicalResolver, searchContent, etc.) — unrelated to T129 work.

The implementation is complete. All new tests pass: the series personalized page backend (pool service, page service, cursor, snapshot, route) and frontend (hook, page component) are fully implemented and verified.

---

## Review

---

## PR Review — T129

### Résumé

L'implémentation est structurellement solide : deux nouvelles tables DB, trois services backend, hook React, réécriture SeriesPage, tests unitaires, migration Drizzle. La logique exploitation/exploration, cache snapshot, déduplication cross-shelf, exclusion des séries en cours et curseur HMAC sont tous corrects dans l'ensemble.

Deux points bloquants identifiés.

---

### Points validés

- **Series-only constraint** : `mediaTypeFilter: 'SERIES'` dans tous les appels `queryForShelf`, double-filtre côté application. Testé.
- **Composition** : 2 rails système (Séries pour toi, Nouvelles séries pour toi) + 2 thématiques exploitation + 1 exploration conditionnel. Correct.
- **Déduplication cross-shelf** : `excludedMediaIds` propagé séquentiellement entre rails. Testé.
- **Cache snapshot** : logique HIT/STALE/MISS, stale-while-revalidate, snapshot sauvegardé async. Conforme au pattern Home.
- **Séries en cours exclues** : via `viewingProgress + episodes`, seuil 60s. Testé.
- **Curseur sécurisé** : HMAC SHA-256, timing-safe compare, TTL 48h.
- **Pas de thèmes hardcodés** : sélection dynamique depuis `shelfConcepts` filtrés.
- **Migration DB** : présente, FK en cascade, index.
- **Frontend** : `ShelfErrorBoundary` par shelf, skeleton, infinite scroll, EmptyState/ErrorState.

---

### Problèmes détectés

**🔴 BLOQUANT #1 — Requête trailers non bornée** (`series-page-service.ts:238`)

```typescript
// Actuel — BUG : charge TOUS les trailers series de la base
.where(eq(mediaVideos.mediaType, 'series'))

// Requis — déjà correct dans series-pool-service.ts:383
.where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
```

Chaque appel HIT/STALE de reconstruction snapshot charge l'intégralité de `media_videos` pour les séries. Risque de timeout/OOM en production.

**🔴 BLOQUANT #2 — Test snapshot reuse manquant**

Le plan et les critères d'acceptance stipulent explicitement : *"A second call within TTL returns the same sessionId and does not trigger a new LLM/concept generation call (verified by mock call count in tests)."* Ce test n'existe ni dans `series-pool-service.test.ts` ni dans `series-personalized.test.ts`. Il n'y a pas de `series-page-service.test.ts`.

**🟡 MINEUR — `isSeriesSnapshotStale` ignore `invalidatedAt`** : un snapshot invalidé+expiré sera servi STALE plutôt que MISS, ce qui contourne l'intent d'invalidation explicite.

---

### Actions requises

1. Ajouter `inArray(mediaVideos.mediaId, seriesIds)` au `WHERE` de la requête trailers dans `batchRowsToShelfResponses`.
2. Ajouter un test qui vérifie qu'un deuxième appel dans la TTL retourne le même `sessionId` sans rappeler `buildSeriesDeclaredRails` (mock call count = 0).

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T129/reviews/implementation-review.md
- generated at: 2026-08-24T13:30:41Z

---

---

## PR Review — T129

### Résumé

L'implémentation est structurellement solide : deux nouvelles tables DB, trois services backend, hook React, réécriture SeriesPage, tests unitaires, migration Drizzle. La logique exploitation/exploration, cache snapshot, déduplication cross-shelf, exclusion des séries en cours et curseur HMAC sont tous corrects dans l'ensemble.

Deux points bloquants identifiés.

---

### Points validés

- **Series-only constraint** : `mediaTypeFilter: 'SERIES'` dans tous les appels `queryForShelf`, double-filtre côté application. Testé.
- **Composition** : 2 rails système (Séries pour toi, Nouvelles séries pour toi) + 2 thématiques exploitation + 1 exploration conditionnel. Correct.
- **Déduplication cross-shelf** : `excludedMediaIds` propagé séquentiellement entre rails. Testé.
- **Cache snapshot** : logique HIT/STALE/MISS, stale-while-revalidate, snapshot sauvegardé async. Conforme au pattern Home.
- **Séries en cours exclues** : via `viewingProgress + episodes`, seuil 60s. Testé.
- **Curseur sécurisé** : HMAC SHA-256, timing-safe compare, TTL 48h.
- **Pas de thèmes hardcodés** : sélection dynamique depuis `shelfConcepts` filtrés.
- **Migration DB** : présente, FK en cascade, index.
- **Frontend** : `ShelfErrorBoundary` par shelf, skeleton, infinite scroll, EmptyState/ErrorState.

---

### Problèmes détectés

**🔴 BLOQUANT #1 — Requête trailers non bornée** (`series-page-service.ts:238`)

```typescript
// Actuel — BUG : charge TOUS les trailers series de la base
.where(eq(mediaVideos.mediaType, 'series'))

// Requis — déjà correct dans series-pool-service.ts:383
.where(and(eq(mediaVideos.mediaType, 'series'), inArray(mediaVideos.mediaId, seriesIds)))
```

Chaque appel HIT/STALE de reconstruction snapshot charge l'intégralité de `media_videos` pour les séries. Risque de timeout/OOM en production.

**🔴 BLOQUANT #2 — Test snapshot reuse manquant**

Le plan et les critères d'acceptance stipulent explicitement : *"A second call within TTL returns the same sessionId and does not trigger a new LLM/concept generation call (verified by mock call count in tests)."* Ce test n'existe ni dans `series-pool-service.test.ts` ni dans `series-personalized.test.ts`. Il n'y a pas de `series-page-service.test.ts`.

**🟡 MINEUR — `isSeriesSnapshotStale` ignore `invalidatedAt`** : un snapshot invalidé+expiré sera servi STALE plutôt que MISS, ce qui contourne l'intent d'invalidation explicite.

---

### Actions requises

1. Ajouter `inArray(mediaVideos.mediaId, seriesIds)` au `WHERE` de la requête trailers dans `batchRowsToShelfResponses`.
2. Ajouter un test qui vérifie qu'un deuxième appel dans la TTL retourne le même `sessionId` sans rappeler `buildSeriesDeclaredRails` (mock call count = 0).

IMPLEMENTATION_FIX_REQUIRED