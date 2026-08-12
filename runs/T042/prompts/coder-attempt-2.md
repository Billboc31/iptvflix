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


# T042 — Generate personalized Shelves from seed media and recommendation intent

**Source**: GitHub Issue #83

## Description

## Objective

Allow a user to create a personalized Shelf by selecting a small set of seed Movies/Series, such as three films they like, and let IPTVFlix generate a coherent recommendation-based Shelf from those seeds.

## Context / Problem

The Shelf model already supports reusable manual/dynamic composition, and the new recommendation engine will provide ranked candidates. A key product experience is to let the user say, in effect, “build me a Shelf from these 3 films” without exposing low-level recommendation filters.

The generated Shelf must preserve a durable intent so it can be refreshed as the catalog/discovery pool evolves, rather than becoming only a frozen one-time list.

## Included

- Add a backend/domain operation that accepts a bounded set of canonical seed Media plus optional supported constraints such as media type, availability-to-me and runtime where the current model can enforce them reliably.
- Derive a recommendation intent/profile from the seed Media using existing metadata and recommendation boundaries; do not introduce provider-specific logic.
- Generate an ordered Shelf whose members reference canonical Media identities only.
- Persist enough generation metadata/intent so the Shelf can be refreshed deterministically later.
- Materialize external discovery candidates into canonical zero-Availability Media only when needed for durable Shelf membership, reusing existing identity/deduplication rules.
- Expose a lightweight web flow for selecting seed Media and creating the Shelf.
- Return concise explanation metadata describing why the Shelf was generated, without making an LLM call mandatory for runtime functionality.

## Acceptance Criteria

- [ ] A user can select at least 3 canonical Movies/Series and create a generated Shelf.
- [ ] The Shelf contains ranked recommendations derived from the seeds and current recommendation engine.
- [ ] Seed titles themselves are not duplicated as recommendations unless explicitly allowed by a documented rule.
- [ ] Shelf members are canonical Media, never provider item IDs or raw external candidates.
- [ ] External candidates are safely deduplicated/materialized when durable membership requires it.
- [ ] The generated Shelf stores enough intent/provenance to be refreshed later.
- [ ] Optional constraints are validated server-side and reuse existing availability semantics.
- [ ] Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence.

## Excluded / Out of scope

- Free-form natural-language Shelf prompts.
- Sharing shelves between profiles.
- Mandatory LLM generation of the Shelf.

## Dependencies

Requires #81 recommendation ranking and the existing Shelf model from #38.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. Here is a summary of every file created or modified:

---

## Summary

### Files created
- **`apps/api/migrations/0019_generated_shelf.sql`** — Drizzle-generated migration: `ALTER TYPE "public"."shelf_type" ADD VALUE 'GENERATED'`
- **`apps/api/migrations/meta/0019_snapshot.json`** — Drizzle snapshot (auto-generated)
- **`apps/api/src/services/shelf-generation-service.ts`** — New service with:
  - `generateShelfFromSeeds(profileId, body)` — validates 2–10 seeds, infers genres, ranks via existing engine, filters seeds, materializes discovery candidates, persists shelf + members + rules intent
  - `materializeDiscoveryCandidate(candidateId, mediaType)` — private helper: checks for existing canonical link, otherwise creates canonical Movie/Series with zero availability and writes FK back
  - `refreshGeneratedShelf(shelfId, profileId)` — replaces members and updates `generatedAt` in rules
- **`apps/api/src/services/__tests__/shelf-generation-service.test.ts`** — 14 tests covering all plan scenarios: seed count validation, unknown seed rejection, determinism, seed exclusion, deduplication, materialization, `availableToMe` constraint, persistence, refresh, and explanation metadata

### Files modified
- **`packages/api-contracts/src/shelves.ts`** — Added `GENERATED` to `ShelfType`; added `SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse` types
- **`apps/api/src/db/schema/shelves.ts`** — Added `'GENERATED'` to `shelfTypeEnum`
- **`apps/api/src/services/recommendation-ranking-service.ts`** — Added `positiveMediaIds?: string[]` to `RankOpts`; merged with taste `positiveMediaIds` for scoring
- **`apps/api/src/services/shelf-service.ts`** — `getShelf` resolves `GENERATED` shelves via stored `shelfMembers` (same as MANUAL); updated type casts throughout
- **`apps/api/src/routes/shelves.ts`** — Added `POST /shelves/generate` (creates generated shelf, 201) and `POST /shelves/:id/refresh` (refreshes existing GENERATED shelf); server-side validation of seed count, mediaType, and each seed entry

---

## Review

Now I have enough context to write the full review.

---

# PR Review — T042: Generate personalized Shelves from seed media

## Résumé

L'implémentation couvre l'essentiel du plan : service `shelf-generation-service.ts`, routes `POST /shelves/generate` et `POST /shelves/:id/refresh`, migration enum, types partagés, et 14 tests. Le code est lisible et bien structuré. Cependant, deux problèmes bloquants sont identifiés : un écart direct avec un critère d'acceptation du ticket (seuil minimum de seeds), et une faille de design significative sur le comportement de recommandation attendu.

---

## Vérifications effectuées

- Lecture complète du ticket T042, du plan, et de l'`implementation-output.md`
- Lecture des fichiers : `shelf-generation-service.ts`, test file, `shelves.ts` (routes), `shelves.ts` (schema), `api-contracts/shelves.ts`, `recommendation-ranking-service.ts`, `shelf-service.ts`, migration SQL
- Vérification de chaque critère d'acceptation du ticket et du plan
- Analyse de la logique de ranking et de l'usage de `positiveMediaIds`
- Analyse des opérations DB et de leur atomicité

---

## Points validés

- **Schema** : `GENERATED` ajouté à `shelfTypeEnum`, migration SQL correcte (`ALTER TYPE ADD VALUE`), aucune colonne superflue, intent stocké dans `rules` JSONB sous `GeneratedShelfRules`.
- **Validation des seeds** : format (`mediaType` + `mediaId`), existence canonique vérifiée, erreurs descriptives renvoyées.
- **Exclusion des seeds** : filtrage post-ranking via `seedIdSet`, les seeds n'apparaissent pas dans les membres.
- **Matérialisation** : le helper `materializeDiscoveryCandidate` vérifie d'abord le lien canonical existant avant d'insérer, idempotent et correct.
- **Déduplication** : un candidat DISCOVERY avec `canonicalMovieId` existant ne crée pas de nouvelle ligne canonique (testé, correct).
- **Persistence du intent** : `rules.seedMediaIds`, `rules.inferredGenreIds`, `rules.generatedAt` persistés.
- **Refresh** : membres remplacés, `generatedAt` mis à jour, intent inchangé, rejet correct des shelves non-GENERATED (400), 404 si shelf inexistant.
- **Routes** : ordre de registration correct, pas de conflit Fastify entre `/shelves/generate` (statique) et `/shelves/:id` (dynamique), validation côté serveur complète.
- **Types partagés** : `SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse` bien typés et cohérents.
- **Couverture de tests** : 14 scénarios couvrant tous les cas du plan.
- **Sécurité** : aucun secret hardcodé, validation entrées à la frontière (route handler), `ForbiddenError` sur ownership du shelf.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Minimum de seeds : 2 dans l'implémentation, 3 dans le ticket

Le critère d'acceptation du ticket est explicite :
> *"A user can select **at least 3** canonical Movies/Series and create a generated Shelf."*

Le plan a changé ce seuil à 2 sans justification documentée. L'implémentation suit le plan (2–10), y compris dans les tests (`accepts exactly 2 seeds`). C'est une violation directe d'un critère d'acceptation ticket.

**Correction requise** :
- `shelf-generation-service.ts` ligne ~175 : changer `seedMediaIds.length < 2` → `seedMediaIds.length < 3`
- `shelves.ts` (routes) : changer la validation route (`< 2` → `< 3`) et le message d'erreur
- Test `accepts exactly 2 seeds` → renommer et valider avec 3 seeds ; ajouter un test de rejet à 2 seeds

---

### 🔴 BLOQUANT 2 — Les seeds n'influencent pas les recommandations des autres médias

Le ticket dit :
> *"Derive a recommendation intent/profile from the seed Media using existing metadata and recommendation boundaries"*
> *"The Shelf contains ranked recommendations derived from the seeds and current recommendation engine."*

L'implémentation passe `positiveMediaIds: seedIds` au ranking service. Or, dans `recommendation-ranking-service.ts`, `positiveMediaIds` sert uniquement à un bonus direct sur le media ID lui-même (`+5.0` si `positiveMediaIds.has(c.mediaId)`). Les seeds sont ensuite filtrés des résultats. Résultat : **les seeds donnent un bonus à des items qui sont immédiatement supprimés, et n'influencent pas le score des autres candidats**.

Les recommandations générées sont celles du profil de goût existant de l'utilisateur, indépendamment des seeds choisis. La personnalisation "from seeds" est absente au niveau du ranking.

**L'intent stocké** (`inferredGenreIds`) est correct pour l'explication, mais il n'est pas utilisé pour booter le scoring.

**Correction requise** :
L'approche la plus simple et sans régression : dans `resolveGeneratedMembers`, après avoir collecté `inferredGenreIds`, les passer à `rankRecommendations` via un mécanisme existant (ou une option `preferGenreIds`) pour qu'ils influencent le genre affinity scoring. Si le ranking service ne supporte pas encore cette option, il faut l'ajouter, ou à défaut, documenter explicitement dans le code pourquoi ce comportement est acceptable (et le confirmer dans le plan).

---

### 🟡 MODÉRÉ — Refresh non-atomique : risque de perte de membres

Dans `refreshGeneratedShelf` :
```typescript
await db.delete(shelfMembers).where(eq(shelfMembers.shelfId, shelfId))  // step 1
await db.insert(shelfMembers).values(...)                                 // step 2
await db.update(shelves).set({ rules: updatedRules }).where(...)         // step 3
```

Si step 2 ou 3 échoue après le DELETE, le shelf se retrouve sans membres et avec des règles potentiellement désynchronisées. Il n'y a pas de transaction englobante.

**Correction recommandée** : wrapper dans une transaction DB (`db.transaction(async (tx) => { ... })`). Ne bloque pas si l'équipe accepte ce risque en v1, mais doit être documenté.

---

### 🟡 MODÉRÉ — Aucune influence des seeds sur les candidats DISCOVERY

Le filtrage des seeds dans `resolveGeneratedMembers` :
```typescript
const seedIdSet = new Set(seedMediaIds.map((s) => s.mediaId))
const candidates = recs.candidates.filter((c) => !seedIdSet.has(c.mediaId))
```

Pour les candidats `source: 'DISCOVERY'`, `c.mediaId` est l'ID du discovery candidate, pas l'ID canonique. Si un titre seed existe aussi comme discovery candidate (peu probable mais possible), il ne sera pas filtré. Risque faible en pratique (UUIDs différents), mais valeur mentionnée pour exhaustivité.

---

### 🟢 MINEUR — Pas de validation du format UUID pour `mediaId`

Aucune vérification que les `mediaId` sont des UUIDs valides. Une valeur invalide provoquera une erreur DB non-descriptive. Acceptable en v1 si la validation UUID est gérée au niveau DB.

---

## Risques éventuels

- La modification de `recommendation-ranking-service.ts` (ajout de `positiveMediaIds` à `RankOpts`) est partagée avec le ranking standard. Si le comportement actuel (`+5.0` bonus) est utilisé par d'autres callers, le changement de comportement pourrait affecter les recommandations classiques. À vérifier avant toute modification.
- La sérialisation `GeneratedShelfRules` en JSONB n'a pas de validation de schema à la lecture (`shelf.rules as GeneratedShelfRules`). Un `rules` corrompu ferait crasher le refresh sans message utile.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** : Corriger le minimum de seeds de 2 à 3, conformément au critère d'acceptation du ticket. Mettre à jour les tests en conséquence.
2. **Obligatoire** : Corriger le mécanisme de dérivation de recommendations depuis les seeds — le passage de `positiveMediaIds` au ranking service ne produit pas de recommendations influencées par les seeds. Soit adapter le ranking service pour utiliser les `inferredGenreIds` des seeds comme boost de genre, soit documenter et justifier explicitement pourquoi le comportement actuel est acceptable au regard du ticket.
3. **Recommandé** : Wrapper `refreshGeneratedShelf` dans une transaction DB pour éviter l'état partiel.
4. **Optionnel** : Ajouter une validation defensive du schéma `GeneratedShelfRules` à la lecture en `refreshGeneratedShelf`.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T042/reviews/implementation-review.md
- generated at: 2026-08-12T13:16:24Z

---

Now I have enough context to write the full review.

---

# PR Review — T042: Generate personalized Shelves from seed media

## Résumé

L'implémentation couvre l'essentiel du plan : service `shelf-generation-service.ts`, routes `POST /shelves/generate` et `POST /shelves/:id/refresh`, migration enum, types partagés, et 14 tests. Le code est lisible et bien structuré. Cependant, deux problèmes bloquants sont identifiés : un écart direct avec un critère d'acceptation du ticket (seuil minimum de seeds), et une faille de design significative sur le comportement de recommandation attendu.

---

## Vérifications effectuées

- Lecture complète du ticket T042, du plan, et de l'`implementation-output.md`
- Lecture des fichiers : `shelf-generation-service.ts`, test file, `shelves.ts` (routes), `shelves.ts` (schema), `api-contracts/shelves.ts`, `recommendation-ranking-service.ts`, `shelf-service.ts`, migration SQL
- Vérification de chaque critère d'acceptation du ticket et du plan
- Analyse de la logique de ranking et de l'usage de `positiveMediaIds`
- Analyse des opérations DB et de leur atomicité

---

## Points validés

- **Schema** : `GENERATED` ajouté à `shelfTypeEnum`, migration SQL correcte (`ALTER TYPE ADD VALUE`), aucune colonne superflue, intent stocké dans `rules` JSONB sous `GeneratedShelfRules`.
- **Validation des seeds** : format (`mediaType` + `mediaId`), existence canonique vérifiée, erreurs descriptives renvoyées.
- **Exclusion des seeds** : filtrage post-ranking via `seedIdSet`, les seeds n'apparaissent pas dans les membres.
- **Matérialisation** : le helper `materializeDiscoveryCandidate` vérifie d'abord le lien canonical existant avant d'insérer, idempotent et correct.
- **Déduplication** : un candidat DISCOVERY avec `canonicalMovieId` existant ne crée pas de nouvelle ligne canonique (testé, correct).
- **Persistence du intent** : `rules.seedMediaIds`, `rules.inferredGenreIds`, `rules.generatedAt` persistés.
- **Refresh** : membres remplacés, `generatedAt` mis à jour, intent inchangé, rejet correct des shelves non-GENERATED (400), 404 si shelf inexistant.
- **Routes** : ordre de registration correct, pas de conflit Fastify entre `/shelves/generate` (statique) et `/shelves/:id` (dynamique), validation côté serveur complète.
- **Types partagés** : `SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse` bien typés et cohérents.
- **Couverture de tests** : 14 scénarios couvrant tous les cas du plan.
- **Sécurité** : aucun secret hardcodé, validation entrées à la frontière (route handler), `ForbiddenError` sur ownership du shelf.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Minimum de seeds : 2 dans l'implémentation, 3 dans le ticket

Le critère d'acceptation du ticket est explicite :
> *"A user can select **at least 3** canonical Movies/Series and create a generated Shelf."*

Le plan a changé ce seuil à 2 sans justification documentée. L'implémentation suit le plan (2–10), y compris dans les tests (`accepts exactly 2 seeds`). C'est une violation directe d'un critère d'acceptation ticket.

**Correction requise** :
- `shelf-generation-service.ts` ligne ~175 : changer `seedMediaIds.length < 2` → `seedMediaIds.length < 3`
- `shelves.ts` (routes) : changer la validation route (`< 2` → `< 3`) et le message d'erreur
- Test `accepts exactly 2 seeds` → renommer et valider avec 3 seeds ; ajouter un test de rejet à 2 seeds

---

### 🔴 BLOQUANT 2 — Les seeds n'influencent pas les recommandations des autres médias

Le ticket dit :
> *"Derive a recommendation intent/profile from the seed Media using existing metadata and recommendation boundaries"*
> *"The Shelf contains ranked recommendations derived from the seeds and current recommendation engine."*

L'implémentation passe `positiveMediaIds: seedIds` au ranking service. Or, dans `recommendation-ranking-service.ts`, `positiveMediaIds` sert uniquement à un bonus direct sur le media ID lui-même (`+5.0` si `positiveMediaIds.has(c.mediaId)`). Les seeds sont ensuite filtrés des résultats. Résultat : **les seeds donnent un bonus à des items qui sont immédiatement supprimés, et n'influencent pas le score des autres candidats**.

Les recommandations générées sont celles du profil de goût existant de l'utilisateur, indépendamment des seeds choisis. La personnalisation "from seeds" est absente au niveau du ranking.

**L'intent stocké** (`inferredGenreIds`) est correct pour l'explication, mais il n'est pas utilisé pour booter le scoring.

**Correction requise** :
L'approche la plus simple et sans régression : dans `resolveGeneratedMembers`, après avoir collecté `inferredGenreIds`, les passer à `rankRecommendations` via un mécanisme existant (ou une option `preferGenreIds`) pour qu'ils influencent le genre affinity scoring. Si le ranking service ne supporte pas encore cette option, il faut l'ajouter, ou à défaut, documenter explicitement dans le code pourquoi ce comportement est acceptable (et le confirmer dans le plan).

---

### 🟡 MODÉRÉ — Refresh non-atomique : risque de perte de membres

Dans `refreshGeneratedShelf` :
```typescript
await db.delete(shelfMembers).where(eq(shelfMembers.shelfId, shelfId))  // step 1
await db.insert(shelfMembers).values(...)                                 // step 2
await db.update(shelves).set({ rules: updatedRules }).where(...)         // step 3
```

Si step 2 ou 3 échoue après le DELETE, le shelf se retrouve sans membres et avec des règles potentiellement désynchronisées. Il n'y a pas de transaction englobante.

**Correction recommandée** : wrapper dans une transaction DB (`db.transaction(async (tx) => { ... })`). Ne bloque pas si l'équipe accepte ce risque en v1, mais doit être documenté.

---

### 🟡 MODÉRÉ — Aucune influence des seeds sur les candidats DISCOVERY

Le filtrage des seeds dans `resolveGeneratedMembers` :
```typescript
const seedIdSet = new Set(seedMediaIds.map((s) => s.mediaId))
const candidates = recs.candidates.filter((c) => !seedIdSet.has(c.mediaId))
```

Pour les candidats `source: 'DISCOVERY'`, `c.mediaId` est l'ID du discovery candidate, pas l'ID canonique. Si un titre seed existe aussi comme discovery candidate (peu probable mais possible), il ne sera pas filtré. Risque faible en pratique (UUIDs différents), mais valeur mentionnée pour exhaustivité.

---

### 🟢 MINEUR — Pas de validation du format UUID pour `mediaId`

Aucune vérification que les `mediaId` sont des UUIDs valides. Une valeur invalide provoquera une erreur DB non-descriptive. Acceptable en v1 si la validation UUID est gérée au niveau DB.

---

## Risques éventuels

- La modification de `recommendation-ranking-service.ts` (ajout de `positiveMediaIds` à `RankOpts`) est partagée avec le ranking standard. Si le comportement actuel (`+5.0` bonus) est utilisé par d'autres callers, le changement de comportement pourrait affecter les recommandations classiques. À vérifier avant toute modification.
- La sérialisation `GeneratedShelfRules` en JSONB n'a pas de validation de schema à la lecture (`shelf.rules as GeneratedShelfRules`). Un `rules` corrompu ferait crasher le refresh sans message utile.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** : Corriger le minimum de seeds de 2 à 3, conformément au critère d'acceptation du ticket. Mettre à jour les tests en conséquence.
2. **Obligatoire** : Corriger le mécanisme de dérivation de recommendations depuis les seeds — le passage de `positiveMediaIds` au ranking service ne produit pas de recommendations influencées par les seeds. Soit adapter le ranking service pour utiliser les `inferredGenreIds` des seeds comme boost de genre, soit documenter et justifier explicitement pourquoi le comportement actuel est acceptable au regard du ticket.
3. **Recommandé** : Wrapper `refreshGeneratedShelf` dans une transaction DB pour éviter l'état partiel.
4. **Optionnel** : Ajouter une validation defensive du schéma `GeneratedShelfRules` à la lecture en `refreshGeneratedShelf`.

---

IMPLEMENTATION_FIX_REQUIRED