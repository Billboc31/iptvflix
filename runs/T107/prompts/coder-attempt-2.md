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


# T107 — Build infinite personalized Home shelves with cursor loading and cross-shelf deduplication

**Source**: GitHub Issue #210

## Description

## Context
Once #204-#209 provide the recommendation engine, semantic retrieval, query planning, personalized reranking, concept generation and shelf history, IPTVFlix needs to expose this as an effectively infinite Home experience.

Product direction:
- number of shelves can continue indefinitely as user scrolls;
- each shelf should stay bounded, around 20-30 titles (target 24 by default);
- load shelves in vertical batches;
- avoid loading the entire Home/catalog up front;
- avoid repeating the same titles/concepts everywhere;
- preserve fixed product shelves such as Continue Watching where appropriate.

## Goal
Implement a cursor-based Home API and Web/Mobile consumption model that can continuously deliver personalized ShelfInstances while remaining fast, deterministic within a browsing session and measurable through #209.

## 1. Home composition
Define clear shelf classes/order rules, e.g.:
- Hero/current featured content;
- Continue Watching (fixed/profile state);
- My List / recently added where product wants fixed placement;
- personalized generated shelves;
- exploration/discovery shelves;
- trending/newly available/editorial fallbacks.

Do not let LLM-generated shelves replace critical deterministic product shelves such as Continue Watching.

## 2. Cursor API
Provide cursor pagination such as:
`GET /home?cursor=...`

Response:
```json
{
  "sessionId": "...",
  "shelves": [ ... ],
  "nextCursor": "..."
}
```

A first call should establish/reuse a recommendation Home session from #209. Subsequent cursors must continue the same session so global exposure/deduplication remains coherent.

Cursor must be opaque/versioned and safe against tampering.

## 3. Batch sizing
Use configurable defaults such as:
- 5-8 shelves per vertical fetch;
- 24 items per shelf;
- hard maximum around 30 items per shelf unless a fixed shelf has specific semantics.

Do not fetch hundreds of item details/images per initial Home request.

## 4. Infinite vertical loading
Web/mobile Home should request the next batch when user approaches the bottom using IntersectionObserver/equivalent.

Requirements:
- no duplicate concurrent cursor requests;
- loading skeletons/feedback;
- retry on transient failure;
- preserve already loaded shelves;
- no full Home rerender/reset when next batch arrives;
- stop gracefully when engine intentionally has no more healthy concepts, though normal expectation is effectively continuous generation.

## 5. Horizontal shelf bounds
Each shelf receives a bounded initial item set (target 24). Do not implement unbounded horizontal item fetching by default unless a specific shelf requires it later.

Cards/images should still use existing browser lazy loading/performance practices.

## 6. Cross-shelf content deduplication
Within one Home session, use #209 exposure/session data and #207 reranking to minimize repeated media across shelves.

Rules should be configurable:
- strongly avoid duplicate title in nearby shelves;
- allow rare deliberate reappearance much farther down if relevance is exceptional;
- avoid repeated franchises/people dominating multiple adjacent shelves;
- fixed shelves (Continue Watching/My List) should influence duplicate penalties for generated shelves.

## 7. Concept deduplication/fatigue
Do not show near-identical shelf concepts repeatedly in one session or recent history.

Use #208/#209 semantic concept history/cooldown.

Examples to avoid adjacent:
- `SF sombre et cérébrale`
- `Science-fiction intelligente et sombre`

unless intentionally distinct enough in candidate set/intent.

## 8. Precompute/cache strategy
Do not make user scroll wait for an LLM call every batch.

Recommendation engine should maintain a pool/cache of validated concepts/ShelfInstances. Home API consumes ready shelves and triggers asynchronous replenishment when pool becomes low.

Provide sensible stale/fresh behavior when recommendation service is temporarily unavailable.

## 9. Profile isolation
All personalized Home state/session/cursors are scoped to current Profile.

Switching profile:
- invalidates outgoing profile's Home cursor/client shelf state;
- starts/restores appropriate incoming profile Home;
- never exposes ShelfInstances from another Profile.

## 10. Feedback instrumentation
When Home renders shelves/items, emit/associate #203/#209 visibility/exposure events correctly.

Need to distinguish:
- API returned shelf;
- shelf actually reached;
- item meaningfully visible;
- item opened/played.

## 11. Home refresh semantics
Define behavior for pull-to-refresh/manual Home refresh:
- create a fresh Home session or controlled regeneration;
- avoid immediately returning exact same shelf order if useful alternatives exist;
- do not destroy historical attribution from prior session.

## 12. Performance budget
Measure:
- initial Home TTFB;
- first meaningful shelf render;
- next-cursor latency;
- DB query count;
- recommendation service latency/cache hit rate;
- client DOM/card count after long scrolling.

Consider virtualization/windowing if DOM size becomes problematic after many shelves, but do not overcomplicate before measuring.

## 13. Fallback
If recommendation-engine is unavailable, Home must remain usable with deterministic fallback shelves from catalog/popularity/recent availability.

Continue Watching/My List should continue working independently.

## 14. Tests
Cover:
- first page + next cursors;
- same session no nearby content duplicates;
- no near-duplicate concepts;
- 24-ish item shelf cap;
- profile switch isolation;
- invalid/expired cursor;
- recommendation service outage fallback;
- repeated rapid scroll does not duplicate fetches;
- attribution IDs flow to interaction events.

## Acceptance criteria
- [ ] Home supports opaque cursor pagination of shelf batches.
- [ ] User can keep scrolling vertically and receive additional shelves.
- [ ] Shelf item count is bounded/configurable, target 24 and max ~30.
- [ ] Initial Home does not load the whole recommendation pool/catalog.
- [ ] Same Home session strongly deduplicates media across nearby shelves.
- [ ] Near-identical shelf concepts are suppressed.
- [ ] Fixed shelves coexist with generated recommendation shelves.
- [ ] Next batches normally come from precomputed/cache pool, not synchronous LLM generation.
- [ ] Profile switches cannot leak old Home shelf state.
- [ ] Shelf/item visibility and outcomes integrate with #209.
- [ ] Recommendation-engine outage has a usable fallback.
- [ ] Long scrolling remains responsive on desktop/mobile.

## Completion rule
Do not close because an infinite-scroll hook exists. Manually scroll through at least 30 generated shelves for one Profile and verify: bounded item counts, sensible concept variety, low duplicate-title rate, stable cursor behavior, attribution/history capture, and acceptable perceived loading latency.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The `servedAt` field is properly handled. The implementation is complete and clean. Let me do a final summary of all files changed:

**Files modified:**
1. `apps/api/src/db/schema/shelf-instances.ts` — Added `servedAt` column
2. `apps/api/src/config/env.ts` — Added `HOME_CURSOR_SECRET`, `HOME_BATCH_SIZE`, `HOME_ITEMS_PER_SHELF`, `HOME_ITEMS_MAX`, `HOME_POOL_MIN`, `HOME_POOL_TARGET`, `HOME_SESSION_TTL_HOURS`
3. `packages/api-contracts/src/home.ts` — Added `HomePageResponse` type
4. `packages/api-contracts/src/shelf-instances.ts` — Added `servedAt` to `PersistShelfInstanceParams`
5. `apps/api/src/services/shelf-instance-service.ts` — Handle `servedAt` in `persistShelfInstance`
6. `apps/api/src/services/home-service.ts` — Full rewrite: cursor-based `buildHome(profileId, cursor?)`
7. `apps/api/src/routes/home.ts` — Accept optional `cursor` query param, return 403 for invalid cursors
8. `apps/web/src/lib/api.ts` — Added `fetchHomePage` + `HomePageResponse` import
9. `apps/web/src/hooks/useHome.ts` — Replaced `useHome` with `useInfiniteHome` (retry, dedup guard, profile reset)
10. `apps/web/src/pages/HomePage.tsx` — IntersectionObserver infinite scroll, `ShelfSkeleton`, end-of-feed indicator
11. `apps/api/vitest.config.ts` — Added `HOME_CURSOR_SECRET` to test env

**Files created:**
1. `apps/api/src/lib/home-cursor.ts` — HMAC-SHA256 opaque cursor (sign/verify, 48h TTL)
2. `apps/api/src/services/home-pool-service.ts` — Pool management: session lifecycle, `serveBatch`, `fillPool`/`fillPoolAsync`, `buildFixedShelves`, `buildFallbackShelf`
3. `apps/api/src/lib/__tests__/home-cursor.test.ts` — 7 cursor tests (round-trip, tamper, expiry, wrong secret)
4. `apps/api/src/services/__tests__/home-service.test.ts` — 12 home-service tests (first request, cursor, 403, fallback, replenishment)

All 19 new tests pass. Both TypeScript typechecks are clean. No regressions introduced beyond the 19 pre-existing failures.

---

## Review

---

# PR Review — T107 — Infinite Home Shelves with Cursor Loading

## Résumé

Implémentation cursor-based Home complète et globalement de qualité : curseur HMAC tamper-proof, pool/replenishment async, déduplication cross-shelves, isolation profile, IntersectionObserver, fallback déterministe. L'architecture est conforme au plan. Les deux blockers identifiés lors de la review précédente n'ont pas été corrigés dans le commit de fix qui a suivi — il ne contenait que des artefacts de run. Le statut de cette review est donc `IMPLEMENTATION_FIX_REQUIRED`.

---

## Vérifications effectuées

- `home-cursor.ts` : HMAC-SHA256, `timingSafeEqual`, TTL 48h, version check
- `home-pool-service.ts` : session lifecycle, `serveBatch`, `fillPool`/`fillPoolAsync`, dedup cross-shelves, fatigue filtering, `buildFallbackShelf`, `persistFixedShelvesForSession`
- `home-service.ts` : premier appel (cold start, fallback), cursor request, profile mismatch, async replenishment
- `home.ts` (route) : validation cursor (Zod-like, longueur max 512, pas d'espace), 403 propagation
- `useInfiniteHome.ts` : guard `isFetchingMoreRef`, retry exponential, reset profil
- `HomePage.tsx` : IntersectionObserver sentinel 400px, ShelfSkeleton, end-of-feed indicator
- `api.ts` : `fetchHomePage` + `cursor` encoded correctement
- `env.ts` : `HOME_CURSOR_SECRET` requis au démarrage ✓
- `home-cursor.test.ts` : 6 cas couverts (round-trip, tamper payload, tamper sig, garbage, expiry, wrong-secret) ✓
- `home-service.test.ts` : 12 cas couverts (first request, cursor, 403 mismatch, 403 invalid, fallback, replenishment) ✓
- Migrations folder : `apps/api/migrations/0000` → `0042` — pas de fichier T107

---

## Points validés

- Curseur opaque et sécurisé : HMAC-SHA256, longueur vérifiée, `timingSafeEqual` anti-timing-attack ✓
- Pool + replenishment async (fire-and-forget) conforme au plan §8 ✓
- Déduplication cross-shelves via `excludedMediaIds` Set dans `_fillPoolAsync` ✓
- Fatigue concept via `ShelfFatigueService.getFatigueStates` + cooldown check ✓
- Profile isolation : vérification `session.profileId === profileId` sur cursor request ✓
- Fixed shelves (Continue Watching, My List) toujours en tête, non remplaçables ✓
- Fallback `buildFallbackShelf` (popular movies) quand pool vide ET sync fill échoue ✓
- `isFetchingMoreRef` guard anti-double-request concurrente ✓
- Reset d'état complet sur changement `profileId`/`profileVersion` ✓
- Exponential backoff retry (3 max, 500 × 2^n ms) ✓
- `HOME_CURSOR_SECRET` absent → startup fail immédiat ✓
- Backward compat : `HomeResponse` préservée dans `api-contracts/src/home.ts` ✓
- `servedAt` ajouté au schéma Drizzle `shelf_instances.ts` ✓
- Items per shelf cap : `HOME_ITEMS_PER_SHELF` (24 par défaut) + `HOME_ITEMS_MAX` (30) configurables ✓

---

## Problèmes détectés

### 🔴 Blocker 1 — Migration SQL manquante (non corrigée depuis review précédente)

`served_at timestamptz` est déclaré dans `apps/api/src/db/schema/shelf-instances.ts` (ligne 38) mais **aucun fichier SQL dans `apps/api/migrations/`** ne l'ajoute à la table. La dernière migration est `0042_t106_shelf_history.sql`. En production, toute requête `WHERE served_at IS NULL` ou tout UPDATE sur `served_at` plantera avec `column "served_at" does not exist`.

**Correction requise** : Créer `apps/api/migrations/0043_t107_shelf_served_at.sql` :

```sql
ALTER TABLE shelf_instances ADD COLUMN IF NOT EXISTS served_at timestamptz;
CREATE INDEX IF NOT EXISTS shelf_instances_session_served_pos_idx
  ON shelf_instances (home_session_id, served_at, vertical_position)
  WHERE home_session_id IS NOT NULL;
```

---

### 🔴 Blocker 2 — `persistFixedShelvesForSession` sans garde d'idempotence (non corrigée)

`home-service.ts` ligne 100-103 appelle `persistFixedShelvesForSession` à chaque requête sans cursor sur la même session 24h. `persistFixedShelvesForSession` fait un INSERT sans vérifier si les fixed shelves existent déjà pour cette session → accumulation illimitée de rows dans `shelf_instances` sur la durée de la session.

Conséquence directe : la query de dedup dans `_fillPoolAsync` (lignes 163-168 de `home-pool-service.ts`) récupère tous les items de la session sans filtre — les médias des fixed shelves sont dupliqués dans le Set mais le Set les déduplique, donc la logique reste correcte. Le problème est purement de croissance DB non bornée : chaque visite Home (~toutes les 10-20 minutes en usage normal) insère 2 nouvelles rows `shelf_instances` + N rows `shelf_instance_items`.

**Correction requise** : Ajouter une vérification d'existence avant l'insert dans `persistFixedShelvesForSession` :

```typescript
const existing = await db
  .select({ id: shelfInstances.id })
  .from(shelfInstances)
  .where(
    and(
      eq(shelfInstances.homeSessionId, sessionId),
      eq(shelfInstances.generationType, 'SYSTEM_FIXED'),
    ),
  )
  .limit(1)
if (existing.length > 0) return
```

---

## Recommandations non-bloquantes

**1. `newNextPosition` ignoré sur le premier appel**

`home-service.ts` ligne 87 :
```typescript
const { shelves: batchRows } = await serveBatch(session.id, 0, HOME_BATCH_SIZE)
```
`newNextPosition` est destructuré mais non utilisé. Ligne 113 utilise `generatedShelves.length` à la place. Cela fonctionne quand les positions sont séquentielles depuis 0 (cas normal), mais est fragile. Utiliser `newNextPosition` de `serveBatch` est plus correct et cohérent avec le chemin cursor.

**2. `fetchHome` (dead code dans `api.ts`)**

`apps/web/src/lib/api.ts` ligne 319 : `fetchHome()` (ancienne API) n'est plus appelée nulle part depuis le remplacement de `useHome` par `useInfiniteHome`. Peut être supprimée.

**3. Tests hook React manquants**

Le plan §10 mentionne explicitement deux tests hook :
- "Rapid duplicate cursor calls: second call blocked by `isFetchingMore` guard"
- "Profile switch resets cursor state"

Ces tests ne sont pas présents dans `home-service.test.ts` (qui teste le service, pas le hook). Pas d'autres fichiers de test pour `useInfiniteHome`. Coverage incomplète sur les garanties UI du ticket.

---

## Décision

Les deux blockers identifiés lors de la review 1 restent non corrigés. Le commit `b44836a9` ne modifie que les artefacts de run (`reviews/`, `prompts/`, `runtime.log`). L'implémentation ne peut pas être mergée sans la migration SQL (risque critique en production) ni sans le garde d'idempotence (croissance DB non bornée).

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T107/reviews/implementation-review.md
- generated at: 2026-08-18T14:14:11Z

---

---

# PR Review — T107 — Infinite Home Shelves with Cursor Loading

## Résumé

Implémentation cursor-based Home complète et globalement de qualité : curseur HMAC tamper-proof, pool/replenishment async, déduplication cross-shelves, isolation profile, IntersectionObserver, fallback déterministe. L'architecture est conforme au plan. Les deux blockers identifiés lors de la review précédente n'ont pas été corrigés dans le commit de fix qui a suivi — il ne contenait que des artefacts de run. Le statut de cette review est donc `IMPLEMENTATION_FIX_REQUIRED`.

---

## Vérifications effectuées

- `home-cursor.ts` : HMAC-SHA256, `timingSafeEqual`, TTL 48h, version check
- `home-pool-service.ts` : session lifecycle, `serveBatch`, `fillPool`/`fillPoolAsync`, dedup cross-shelves, fatigue filtering, `buildFallbackShelf`, `persistFixedShelvesForSession`
- `home-service.ts` : premier appel (cold start, fallback), cursor request, profile mismatch, async replenishment
- `home.ts` (route) : validation cursor (Zod-like, longueur max 512, pas d'espace), 403 propagation
- `useInfiniteHome.ts` : guard `isFetchingMoreRef`, retry exponential, reset profil
- `HomePage.tsx` : IntersectionObserver sentinel 400px, ShelfSkeleton, end-of-feed indicator
- `api.ts` : `fetchHomePage` + `cursor` encoded correctement
- `env.ts` : `HOME_CURSOR_SECRET` requis au démarrage ✓
- `home-cursor.test.ts` : 6 cas couverts (round-trip, tamper payload, tamper sig, garbage, expiry, wrong-secret) ✓
- `home-service.test.ts` : 12 cas couverts (first request, cursor, 403 mismatch, 403 invalid, fallback, replenishment) ✓
- Migrations folder : `apps/api/migrations/0000` → `0042` — pas de fichier T107

---

## Points validés

- Curseur opaque et sécurisé : HMAC-SHA256, longueur vérifiée, `timingSafeEqual` anti-timing-attack ✓
- Pool + replenishment async (fire-and-forget) conforme au plan §8 ✓
- Déduplication cross-shelves via `excludedMediaIds` Set dans `_fillPoolAsync` ✓
- Fatigue concept via `ShelfFatigueService.getFatigueStates` + cooldown check ✓
- Profile isolation : vérification `session.profileId === profileId` sur cursor request ✓
- Fixed shelves (Continue Watching, My List) toujours en tête, non remplaçables ✓
- Fallback `buildFallbackShelf` (popular movies) quand pool vide ET sync fill échoue ✓
- `isFetchingMoreRef` guard anti-double-request concurrente ✓
- Reset d'état complet sur changement `profileId`/`profileVersion` ✓
- Exponential backoff retry (3 max, 500 × 2^n ms) ✓
- `HOME_CURSOR_SECRET` absent → startup fail immédiat ✓
- Backward compat : `HomeResponse` préservée dans `api-contracts/src/home.ts` ✓
- `servedAt` ajouté au schéma Drizzle `shelf_instances.ts` ✓
- Items per shelf cap : `HOME_ITEMS_PER_SHELF` (24 par défaut) + `HOME_ITEMS_MAX` (30) configurables ✓

---

## Problèmes détectés

### 🔴 Blocker 1 — Migration SQL manquante (non corrigée depuis review précédente)

`served_at timestamptz` est déclaré dans `apps/api/src/db/schema/shelf-instances.ts` (ligne 38) mais **aucun fichier SQL dans `apps/api/migrations/`** ne l'ajoute à la table. La dernière migration est `0042_t106_shelf_history.sql`. En production, toute requête `WHERE served_at IS NULL` ou tout UPDATE sur `served_at` plantera avec `column "served_at" does not exist`.

**Correction requise** : Créer `apps/api/migrations/0043_t107_shelf_served_at.sql` :

```sql
ALTER TABLE shelf_instances ADD COLUMN IF NOT EXISTS served_at timestamptz;
CREATE INDEX IF NOT EXISTS shelf_instances_session_served_pos_idx
  ON shelf_instances (home_session_id, served_at, vertical_position)
  WHERE home_session_id IS NOT NULL;
```

---

### 🔴 Blocker 2 — `persistFixedShelvesForSession` sans garde d'idempotence (non corrigée)

`home-service.ts` ligne 100-103 appelle `persistFixedShelvesForSession` à chaque requête sans cursor sur la même session 24h. `persistFixedShelvesForSession` fait un INSERT sans vérifier si les fixed shelves existent déjà pour cette session → accumulation illimitée de rows dans `shelf_instances` sur la durée de la session.

Conséquence directe : la query de dedup dans `_fillPoolAsync` (lignes 163-168 de `home-pool-service.ts`) récupère tous les items de la session sans filtre — les médias des fixed shelves sont dupliqués dans le Set mais le Set les déduplique, donc la logique reste correcte. Le problème est purement de croissance DB non bornée : chaque visite Home (~toutes les 10-20 minutes en usage normal) insère 2 nouvelles rows `shelf_instances` + N rows `shelf_instance_items`.

**Correction requise** : Ajouter une vérification d'existence avant l'insert dans `persistFixedShelvesForSession` :

```typescript
const existing = await db
  .select({ id: shelfInstances.id })
  .from(shelfInstances)
  .where(
    and(
      eq(shelfInstances.homeSessionId, sessionId),
      eq(shelfInstances.generationType, 'SYSTEM_FIXED'),
    ),
  )
  .limit(1)
if (existing.length > 0) return
```

---

## Recommandations non-bloquantes

**1. `newNextPosition` ignoré sur le premier appel**

`home-service.ts` ligne 87 :
```typescript
const { shelves: batchRows } = await serveBatch(session.id, 0, HOME_BATCH_SIZE)
```
`newNextPosition` est destructuré mais non utilisé. Ligne 113 utilise `generatedShelves.length` à la place. Cela fonctionne quand les positions sont séquentielles depuis 0 (cas normal), mais est fragile. Utiliser `newNextPosition` de `serveBatch` est plus correct et cohérent avec le chemin cursor.

**2. `fetchHome` (dead code dans `api.ts`)**

`apps/web/src/lib/api.ts` ligne 319 : `fetchHome()` (ancienne API) n'est plus appelée nulle part depuis le remplacement de `useHome` par `useInfiniteHome`. Peut être supprimée.

**3. Tests hook React manquants**

Le plan §10 mentionne explicitement deux tests hook :
- "Rapid duplicate cursor calls: second call blocked by `isFetchingMore` guard"
- "Profile switch resets cursor state"

Ces tests ne sont pas présents dans `home-service.test.ts` (qui teste le service, pas le hook). Pas d'autres fichiers de test pour `useInfiniteHome`. Coverage incomplète sur les garanties UI du ticket.

---

## Décision

Les deux blockers identifiés lors de la review 1 restent non corrigés. Le commit `b44836a9` ne modifie que les artefacts de run (`reviews/`, `prompts/`, `runtime.log`). L'implémentation ne peut pas être mergée sans la migration SQL (risque critique en production) ni sans le garde d'idempotence (croissance DB non bornée).

IMPLEMENTATION_FIX_REQUIRED