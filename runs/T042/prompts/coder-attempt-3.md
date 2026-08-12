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

All four fixes are in place and all tests pass. Here's a summary of what changed:

**Files modified:**

1. **`apps/api/src/services/shelf-generation-service.ts`**
   - Min seeds: `< 2` → `< 3`, error message updated to "between 3 and 10 entries"
   - Ranking call: replaced `positiveMediaIds: seedIds` (useless, seeds are filtered out anyway) with `preferGenreIds: inferredGenreIds` (actually influences scores for non-seed candidates)
   - `refreshGeneratedShelf`: added defensive validation of `rules` schema, wrapped delete/insert/update in a `db.transaction` to prevent partial-state on failure

2. **`apps/api/src/services/recommendation-ranking-service.ts`**
   - Added `preferGenreIds?: string[]` to `RankOpts`
   - Computes `preferGenreBonus` (+3.0 if candidate shares any preferred genre); applied in both cold-start and warm scoring paths so seed-genre signals work for new profiles too

3. **`apps/api/src/routes/shelves.ts`**
   - Route validation: `< 2` → `< 3`, error message updated to match

4. **`apps/api/src/services/__tests__/shelf-generation-service.test.ts`**
   - All flows updated to use 3 seeds (added `MOVIE_ID_E`, `THREE_MOVIE_SEEDS` constant)
   - `'rejects fewer than 2 seeds'` → `'rejects fewer than 3 seeds'` (now uses 2 seeds which are rejected)
   - `'accepts exactly 2 seeds'` → `'rejects exactly 2 seeds'` + `'accepts exactly 3 seeds'`
   - Added `mockDb.transaction` mock (passes `mockDb` as `tx` so existing delete/insert/update mocks still work)
   - Added test: `'rejects refresh when rules are missing or malformed'`
   - Added test: `'passes preferGenreIds derived from seeds to rankRecommendations'`
   - 17 tests total (was 14), all passing

---

## Review

I have all the information needed. Let me write the review.

---

# PR Review — T042 : Generate personalized Shelves from seed media

## Résumé

Il s'agit de la review d'un retry. Les trois problèmes bloquants de la review précédente ont été corrigés : seuil minimum de 3 seeds (était 2), signal de ranking via `preferGenreIds` (bonus genre +3.0 impacte réellement les candidats hors-seeds), et transaction sur `refreshGeneratedShelf`. La base de l'implémentation backend est solide. Deux nouveaux problèmes bloquants sont identifiés : l'absence totale de web flow (explicitement exigé par le ticket) et la non-atomicité de `generateShelfFromSeeds` (risque d'états corrompus en base).

---

## Vérifications effectuées

- Lecture du ticket T042, du plan, et de la review précédente (`runs/T042/reviews/implementation-review.md`)
- Lecture complète de `shelf-generation-service.ts`, `shelves.ts` (routes), `shelf-generation-service.test.ts`, `shelves.test.ts` (routes), `recommendation-ranking-service.ts`, `shelves.ts` (schema), migration `0019_generated_shelf.sql`, `api-contracts/shelves.ts`
- Vérification des corrections demandées par la review précédente
- Recherche exhaustive du web flow dans `apps/web/src/`
- Analyse de l'atomicité des opérations DB dans les deux fonctions publiques

---

## Points validés

**Corrections de la review précédente :**
- ✅ Seuil minimum de seeds : `< 3` dans le service et dans la route, messages d'erreur cohérents, tests mis à jour.
- ✅ Signal de ranking : `preferGenreIds` passé à `rankRecommendations`, bonus `+3.0` dans le ranking service pour les candidats dont les genres correspondent — les seeds influencent effectivement les recommandations via l'affinité de genre.
- ✅ Transaction sur refresh : `refreshGeneratedShelf` enveloppe delete/insert/update dans `db.transaction`, atomicité correcte.

**Points du ticket validés :**
- Schema : `GENERATED` ajouté à `shelfTypeEnum`, migration SQL correcte (`ALTER TYPE ADD VALUE`), intent stocké en `rules` JSONB sous `GeneratedShelfRules`.
- Validation des seeds : format, existence canonique vérifiée, erreurs descriptives.
- Exclusion des seeds du résultat : `seedIdSet` correctement utilisé post-ranking.
- Matérialisation : `materializeDiscoveryCandidate` vérifie le lien canonique avant d'insérer, idempotent.
- Déduplication : candidat DISCOVERY avec `canonicalMovieId` existant ne crée pas de nouvelle ligne.
- Intent persisté : `seedMediaIds`, `inferredGenreIds`, `generatedAt` dans `rules`.
- Refresh : rejet des shelves non-GENERATED (400), 404 si inexistant, rejet si rules malformées.
- Types partagés complets et cohérents (`SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse`).
- Sécurité : aucun secret hardcodé, validation aux frontières, ownership vérifié sur refresh.
- Couverture tests service : 10 scénarios couvrant seed count, unknown seed, déterminisme, exclusion, déduplication, matérialisation, availableToMe, persistance, refresh, explanation.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Web flow absent : critère d'acceptation ticket non satisfait

La section **Included** du ticket est explicite :
> *"Expose a lightweight web flow for selecting seed Media and creating the Shelf."*

Le critère d'acceptation correspondant :
> *"A user can select at least 3 canonical Movies/Series and create a generated Shelf."*

Aucun composant, page ou hook React n'existe pour cette fonctionnalité. La recherche exhaustive dans `apps/web/src/` ne trouve aucune référence à `generate`, `seed`, `GENERATED`, ni `GenerateShelf`. Le plan a explicitement exclu le web flow sans que cette exclusion soit couverte par le ticket — la section "Excluded" du ticket ne mentionne pas l'UI. Le feature est invisible pour l'utilisateur en l'état.

**Correction requise** : implémenter un flow web minimal — une page ou un dialog de sélection de seeds (recherche ou liste de médias), appel `POST /shelves/generate`, affichage de la réponse. L'extension `apps/web/src/lib/api.ts` doit exposer les appels aux deux nouveaux endpoints.

---

### 🔴 BLOQUANT 2 — `generateShelfFromSeeds` non-atomique

`refreshGeneratedShelf` utilise correctement `db.transaction`. `generateShelfFromSeeds` ne le fait pas.

La séquence dans `resolveGeneratedMembers` puis `generateShelfFromSeeds` :
1. Matérialisation de discovery candidates (INSERT canonical Movie/Series + UPDATE discoveryCandidate)
2. SELECT MAX(position)
3. INSERT shelf
4. INSERT shelfMembers

Si l'étape 3 ou 4 échoue après la matérialisation (step 1), des lignes canoniques orphelines existent en base sans aucune appartenance à un shelf. Ces records ont `availability` nulle (zéro rows) et peuvent influencer le pool de recommandations sans jamais être accessibles via un shelf. La matérialisation peut aussi être répétée en cas de retry sans entraîner de doublon (idempotente grâce au check `canonicalMovieId`), mais les records orphelins persistent.

Le ticket dit explicitement : *"Materialize external discovery candidates into canonical zero-Availability Media only when needed for durable Shelf membership"* — la matérialisation doit être liée à la création effective du shelf.

**Correction requise** :

```typescript
// Dans generateShelfFromSeeds, après resolveGeneratedMembers :
await db.transaction(async (tx) => {
  const [shelf] = await tx.insert(shelves).values({ ... }).returning()
  if (members.length > 0) {
    await tx.insert(shelfMembers).values(...).onConflictDoNothing()
  }
})
```

Note : la matérialisation elle-même (dans `resolveGeneratedMembers`) ne peut pas être facilement enveloppée dans la même transaction car elle est appelée avant le retour de `generateShelfFromSeeds`. L'approche la plus propre est de déplacer la matérialisation à l'intérieur de la transaction, ou d'accepter que les candidats matérialisés soient des "pre-allocated" records stables. A minima, le shelf + members doivent être créés atomiquement.

---

### 🟡 MODÉRÉ — Absence de tests HTTP pour les deux nouveaux endpoints

Le fichier `apps/api/src/routes/__tests__/shelves.test.ts` (613 lignes) ne contient aucun test pour `POST /shelves/generate` ni `POST /shelves/:id/refresh`. La validation HTTP de la route (titre absent, `seedMediaIds` manquant, seeds invalides, `mediaType` invalide) n'est pas testée au niveau HTTP. Un bug introduit dans la couche route ne serait détecté que par les tests service (qui mockent le service, pas la route).

Le ticket exige : *"Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence"* — la validation au niveau route (HTTP 400 avec `validationError: true`) n'est pas couverte.

**Correction recommandée** : ajouter dans `shelves.test.ts` au minimum :
- `POST /shelves/generate` 201 (happy path, mock `generateShelfFromSeeds`)
- `POST /shelves/generate` 400 (fewer than 3 seeds, invalid mediaType, missing title)
- `POST /shelves/:id/refresh` 200 (mock `refreshGeneratedShelf`)
- `POST /shelves/:id/refresh` 400 (non-GENERATED shelf — via `ValidationError` mock)

---

### 🟢 MINEUR — Check `!rules.limit` imprécis

`shelf-generation-service.ts`, ligne 241 :
```typescript
if (!rules?.seedMediaIds || !Array.isArray(rules.seedMediaIds) || !rules.limit) {
```

`!rules.limit` est truthy si `limit === 0`. La valeur 0 est hors de la plage valide 1–100, donc ne devrait jamais être stockée, mais le check `rules.limit == null` serait plus précis et résistant à des données corrompues.

---

### 🟢 MINEUR — Doublons dans `seedMediaIds` non rejetés

Si le même `mediaId` apparaît deux fois dans `seedMediaIds`, il passe la validation (array de 3–10 éléments). La déduplication post-ranking via `seedIdSet` fonctionnera correctement (le media est bien exclu du résultat), mais `seedTitles` contiendra ce titre deux fois et le shelf stockera deux occurrences dans `rules.seedMediaIds`. Impact faible mais incohérent pour le refresh.

---

## Risques éventuels

- La modification de `recommendation-ranking-service.ts` (ajout de `preferGenreIds` à `RankOpts`) est partagée avec d'autres callers. Le bonus `+3.0` ne s'applique que si `opts.preferGenreIds` est fourni, donc pas de régression sur les appels existants.
- La désérialisation `shelf.rules as GeneratedShelfRules` sans validation de schema reste un point fragile : un rules corrompu manuellement en DB ferait crasher le refresh avec un message peu descriptif.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** — Implémenter le web flow minimal (page ou dialog de sélection de seeds, hook `useGenerateShelf`, appels aux deux endpoints). C'est un critère d'acceptation ticket non satisfait.
2. **Obligatoire** — Envelopper `INSERT shelves` + `INSERT shelfMembers` dans `generateShelfFromSeeds` dans une transaction `db.transaction`, de la même façon que `refreshGeneratedShelf`.
3. **Recommandé** — Ajouter des tests HTTP pour `POST /shelves/generate` et `POST /shelves/:id/refresh` dans `shelves.test.ts`.
4. **Optionnel** — Remplacer `!rules.limit` par `rules.limit == null` pour un check plus précis.
5. **Optionnel** — Ajouter une déduplication des `seedMediaIds` par `mediaId` à la validation initiale.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T042/reviews/implementation-review.md
- generated at: 2026-08-12T13:29:57Z

---

I have all the information needed. Let me write the review.

---

# PR Review — T042 : Generate personalized Shelves from seed media

## Résumé

Il s'agit de la review d'un retry. Les trois problèmes bloquants de la review précédente ont été corrigés : seuil minimum de 3 seeds (était 2), signal de ranking via `preferGenreIds` (bonus genre +3.0 impacte réellement les candidats hors-seeds), et transaction sur `refreshGeneratedShelf`. La base de l'implémentation backend est solide. Deux nouveaux problèmes bloquants sont identifiés : l'absence totale de web flow (explicitement exigé par le ticket) et la non-atomicité de `generateShelfFromSeeds` (risque d'états corrompus en base).

---

## Vérifications effectuées

- Lecture du ticket T042, du plan, et de la review précédente (`runs/T042/reviews/implementation-review.md`)
- Lecture complète de `shelf-generation-service.ts`, `shelves.ts` (routes), `shelf-generation-service.test.ts`, `shelves.test.ts` (routes), `recommendation-ranking-service.ts`, `shelves.ts` (schema), migration `0019_generated_shelf.sql`, `api-contracts/shelves.ts`
- Vérification des corrections demandées par la review précédente
- Recherche exhaustive du web flow dans `apps/web/src/`
- Analyse de l'atomicité des opérations DB dans les deux fonctions publiques

---

## Points validés

**Corrections de la review précédente :**
- ✅ Seuil minimum de seeds : `< 3` dans le service et dans la route, messages d'erreur cohérents, tests mis à jour.
- ✅ Signal de ranking : `preferGenreIds` passé à `rankRecommendations`, bonus `+3.0` dans le ranking service pour les candidats dont les genres correspondent — les seeds influencent effectivement les recommandations via l'affinité de genre.
- ✅ Transaction sur refresh : `refreshGeneratedShelf` enveloppe delete/insert/update dans `db.transaction`, atomicité correcte.

**Points du ticket validés :**
- Schema : `GENERATED` ajouté à `shelfTypeEnum`, migration SQL correcte (`ALTER TYPE ADD VALUE`), intent stocké en `rules` JSONB sous `GeneratedShelfRules`.
- Validation des seeds : format, existence canonique vérifiée, erreurs descriptives.
- Exclusion des seeds du résultat : `seedIdSet` correctement utilisé post-ranking.
- Matérialisation : `materializeDiscoveryCandidate` vérifie le lien canonique avant d'insérer, idempotent.
- Déduplication : candidat DISCOVERY avec `canonicalMovieId` existant ne crée pas de nouvelle ligne.
- Intent persisté : `seedMediaIds`, `inferredGenreIds`, `generatedAt` dans `rules`.
- Refresh : rejet des shelves non-GENERATED (400), 404 si inexistant, rejet si rules malformées.
- Types partagés complets et cohérents (`SeedMediaRef`, `GeneratedShelfRules`, `GenerateShelfBody`, `GenerateShelfResponse`).
- Sécurité : aucun secret hardcodé, validation aux frontières, ownership vérifié sur refresh.
- Couverture tests service : 10 scénarios couvrant seed count, unknown seed, déterminisme, exclusion, déduplication, matérialisation, availableToMe, persistance, refresh, explanation.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Web flow absent : critère d'acceptation ticket non satisfait

La section **Included** du ticket est explicite :
> *"Expose a lightweight web flow for selecting seed Media and creating the Shelf."*

Le critère d'acceptation correspondant :
> *"A user can select at least 3 canonical Movies/Series and create a generated Shelf."*

Aucun composant, page ou hook React n'existe pour cette fonctionnalité. La recherche exhaustive dans `apps/web/src/` ne trouve aucune référence à `generate`, `seed`, `GENERATED`, ni `GenerateShelf`. Le plan a explicitement exclu le web flow sans que cette exclusion soit couverte par le ticket — la section "Excluded" du ticket ne mentionne pas l'UI. Le feature est invisible pour l'utilisateur en l'état.

**Correction requise** : implémenter un flow web minimal — une page ou un dialog de sélection de seeds (recherche ou liste de médias), appel `POST /shelves/generate`, affichage de la réponse. L'extension `apps/web/src/lib/api.ts` doit exposer les appels aux deux nouveaux endpoints.

---

### 🔴 BLOQUANT 2 — `generateShelfFromSeeds` non-atomique

`refreshGeneratedShelf` utilise correctement `db.transaction`. `generateShelfFromSeeds` ne le fait pas.

La séquence dans `resolveGeneratedMembers` puis `generateShelfFromSeeds` :
1. Matérialisation de discovery candidates (INSERT canonical Movie/Series + UPDATE discoveryCandidate)
2. SELECT MAX(position)
3. INSERT shelf
4. INSERT shelfMembers

Si l'étape 3 ou 4 échoue après la matérialisation (step 1), des lignes canoniques orphelines existent en base sans aucune appartenance à un shelf. Ces records ont `availability` nulle (zéro rows) et peuvent influencer le pool de recommandations sans jamais être accessibles via un shelf. La matérialisation peut aussi être répétée en cas de retry sans entraîner de doublon (idempotente grâce au check `canonicalMovieId`), mais les records orphelins persistent.

Le ticket dit explicitement : *"Materialize external discovery candidates into canonical zero-Availability Media only when needed for durable Shelf membership"* — la matérialisation doit être liée à la création effective du shelf.

**Correction requise** :

```typescript
// Dans generateShelfFromSeeds, après resolveGeneratedMembers :
await db.transaction(async (tx) => {
  const [shelf] = await tx.insert(shelves).values({ ... }).returning()
  if (members.length > 0) {
    await tx.insert(shelfMembers).values(...).onConflictDoNothing()
  }
})
```

Note : la matérialisation elle-même (dans `resolveGeneratedMembers`) ne peut pas être facilement enveloppée dans la même transaction car elle est appelée avant le retour de `generateShelfFromSeeds`. L'approche la plus propre est de déplacer la matérialisation à l'intérieur de la transaction, ou d'accepter que les candidats matérialisés soient des "pre-allocated" records stables. A minima, le shelf + members doivent être créés atomiquement.

---

### 🟡 MODÉRÉ — Absence de tests HTTP pour les deux nouveaux endpoints

Le fichier `apps/api/src/routes/__tests__/shelves.test.ts` (613 lignes) ne contient aucun test pour `POST /shelves/generate` ni `POST /shelves/:id/refresh`. La validation HTTP de la route (titre absent, `seedMediaIds` manquant, seeds invalides, `mediaType` invalide) n'est pas testée au niveau HTTP. Un bug introduit dans la couche route ne serait détecté que par les tests service (qui mockent le service, pas la route).

Le ticket exige : *"Tests cover seed validation, deterministic generation, deduplication, unavailable candidates and persistence"* — la validation au niveau route (HTTP 400 avec `validationError: true`) n'est pas couverte.

**Correction recommandée** : ajouter dans `shelves.test.ts` au minimum :
- `POST /shelves/generate` 201 (happy path, mock `generateShelfFromSeeds`)
- `POST /shelves/generate` 400 (fewer than 3 seeds, invalid mediaType, missing title)
- `POST /shelves/:id/refresh` 200 (mock `refreshGeneratedShelf`)
- `POST /shelves/:id/refresh` 400 (non-GENERATED shelf — via `ValidationError` mock)

---

### 🟢 MINEUR — Check `!rules.limit` imprécis

`shelf-generation-service.ts`, ligne 241 :
```typescript
if (!rules?.seedMediaIds || !Array.isArray(rules.seedMediaIds) || !rules.limit) {
```

`!rules.limit` est truthy si `limit === 0`. La valeur 0 est hors de la plage valide 1–100, donc ne devrait jamais être stockée, mais le check `rules.limit == null` serait plus précis et résistant à des données corrompues.

---

### 🟢 MINEUR — Doublons dans `seedMediaIds` non rejetés

Si le même `mediaId` apparaît deux fois dans `seedMediaIds`, il passe la validation (array de 3–10 éléments). La déduplication post-ranking via `seedIdSet` fonctionnera correctement (le media est bien exclu du résultat), mais `seedTitles` contiendra ce titre deux fois et le shelf stockera deux occurrences dans `rules.seedMediaIds`. Impact faible mais incohérent pour le refresh.

---

## Risques éventuels

- La modification de `recommendation-ranking-service.ts` (ajout de `preferGenreIds` à `RankOpts`) est partagée avec d'autres callers. Le bonus `+3.0` ne s'applique que si `opts.preferGenreIds` est fourni, donc pas de régression sur les appels existants.
- La désérialisation `shelf.rules as GeneratedShelfRules` sans validation de schema reste un point fragile : un rules corrompu manuellement en DB ferait crasher le refresh avec un message peu descriptif.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **Obligatoire** — Implémenter le web flow minimal (page ou dialog de sélection de seeds, hook `useGenerateShelf`, appels aux deux endpoints). C'est un critère d'acceptation ticket non satisfait.
2. **Obligatoire** — Envelopper `INSERT shelves` + `INSERT shelfMembers` dans `generateShelfFromSeeds` dans une transaction `db.transaction`, de la même façon que `refreshGeneratedShelf`.
3. **Recommandé** — Ajouter des tests HTTP pour `POST /shelves/generate` et `POST /shelves/:id/refresh` dans `shelves.test.ts`.
4. **Optionnel** — Remplacer `!rules.limit` par `rules.limit == null` pour un check plus précis.
5. **Optionnel** — Ajouter une déduplication des `seedMediaIds` par `mediaId` à la validation initiale.

---

IMPLEMENTATION_FIX_REQUIRED