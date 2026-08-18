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


# T106 — Persist ShelfConcept/ShelfInstance history and item-level feedback for recommendation learning

**Source**: GitHub Issue #209

## Description

## Context
#203 captures profile interaction events and #208 generates personalized shelf concepts. To improve shelf quality over time we must persist exactly which shelves were generated, which items were actually shown, what scores/models produced them, and how the Profile reacted.

A shelf title string alone is not enough. We need durable recommendation exposure/history so future concept generation and ranking can distinguish:
- bad shelf concept;
- good concept but weak item selection;
- good selection shown too low on Home;
- repeatedly ignored content;
- content opened/played/completed from a specific shelf.

## Goal
Create the durable recommendation-history layer linking concept -> generated shelf instance -> item positions/scores -> real profile feedback.

## 1. Reuse existing event groundwork
Reuse #203 interaction/event architecture. Do not create a second disconnected analytics universe.

The recommendation-history models should provide stable IDs referenced by events such as `SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, `PLAY_STARTED`, etc.

## 2. ShelfConcept vs ShelfInstance
Keep the semantic concept separate from each concrete rendering/generation.

Example:
```text
ShelfConcept
  "SF qui fait réfléchir"
       ↓
ShelfInstance #A on Aug 18
ShelfInstance #B on Aug 24 with newer ranking/profile
```

A `ShelfInstance` should persist enough context such as:
- id;
- profileId;
- shelfConceptId;
- title rendered;
- semantic/query intent snapshot or query-plan reference/version;
- generationType/exploration class;
- generationReason(s);
- createdAt;
- firstDisplayedAt;
- lastDisplayedAt if reused;
- Home/session/cursor batch identity;
- vertical position when displayed;
- recommendation model/ranker version;
- query planner/prompt/model version;
- embedding model/index version;
- candidate count;
- final item count;
- latency/cache status;
- expiration/staleness metadata.

## 3. Shelf item snapshot
Persist concrete ordered items for every generated/displayed ShelfInstance.

Suggested:
```text
ShelfInstanceItem
- shelfInstanceId
- mediaType
- mediaId
- rankPosition
- semanticScore
- profileScore
- finalScore
- diversityAdjustment
- availabilityScore/status snapshot
- reasonCodes
- wasEligibleAtGeneration
```

Do not copy entire TMDB rows into snapshots.

The purpose is to reconstruct why item X was ranked #3 at that moment even if ranking weights/catalog state later change.

## 4. Exposure / visibility
Distinguish `generated` from `actually presented` and `actually visible`.

Track meaningful visibility semantics:
- shelf returned to client;
- shelf reached/visible past a threshold;
- item rendered;
- item meaningfully visible;
- item opened;
- item played.

Do not emit events for every scroll pixel.

Define sensible thresholds, e.g. shelf/item visible for N ms / percentage of viewport, configurable where needed.

## 5. Outcome attribution
Attribute downstream behavior back to the originating ShelfInstance/Item when possible:
- detail opened;
- trailer preview;
- play started;
- meaningful playback milestone;
- completion;
- My List added;
- like/dislike;
- quick abandon.

If user later accesses the same media through search/details independently, do not incorrectly attribute that later action to the shelf forever. Use session/referrer attribution windows.

## 6. Shelf performance aggregates
Create recomputable aggregate metrics per Profile + Concept and optionally globally:
- impressions;
- reached/visible rate;
- item open rate;
- play-through rate;
- meaningful watch rate;
- completion-after-play rate;
- My List add rate;
- quick-abandon rate;
- average rank position clicked;
- repeated-ignore count;
- freshness/novelty performance.

Keep raw durable history so metrics can be recomputed when definitions change.

## 7. Concept fatigue / suppression
Provide deterministic data for #208 to know that a concept has been overused or ignored.

Examples:
- same/near-identical concept shown 5 times in 2 weeks;
- zero interactions across repeated visible impressions;
- repeated item overlap;
- concept recently performed very well and can be refreshed with new items;
- concept performed poorly and should cool down.

Persist cooldown/suppression decisions with reason/version rather than deleting history.

## 8. Content exposure memory
For each Profile maintain efficient ability to answer:
- which media has been shown recently on Home;
- how many times;
- in which concepts;
- whether ignored/opened/played;
- last exposure time.

This supports #207 `recentExposurePenalty` and prevents the same 20 titles appearing in every shelf.

## 9. Recommendation session / Home session
Introduce a stable session/batch identity for one Home browsing session or cursor chain so global de-duplication can reason across shelves in the same session.

Example:
```text
RecommendationHomeSession
- id
- profileId
- startedAt
- expiresAt
- modelVersion
- seenMediaIds / derived exposure refs
- cursor state/reference
```

Do not store giant unbounded arrays if normalized relations/queries are cleaner.

## 10. Experiment/version readiness
Persist experiment/model versions so future A/B evaluation can compare ranking/query strategies.

At minimum make it possible to answer:
`Did reranker v3 outperform v2 for similar shelf concepts?`

No full experiment platform is required yet.

## 11. Admin/Lab diagnostics
In Recommendation Lab allow inspection of:
- recent shelves for a selected Profile;
- concept + generated items;
- all per-item scores;
- which items were actually visible/opened/played;
- resulting shelf performance;
- concept cooldown/fatigue status;
- model/query/embedding versions.

## 12. Retention
Shelf history is valuable but can grow.

Define retention/compaction:
- keep high-level Concept/Instance/outcome data long-term enough to learn;
- preserve high-value outcomes;
- compact low-value raw visibility telemetry after aggregation when safe;
- indexes for profile/time/concept/media.

Do not delete recent exposure memory needed by ranking.

## Acceptance criteria
- [ ] ShelfConcept and concrete ShelfInstance are distinguishable and linked.
- [ ] Every generated shelf can persist ordered item snapshots + scores/reasons.
- [ ] Generated vs displayed vs visible are distinguishable.
- [ ] Item clicks/plays/outcomes can be attributed to originating shelf within defined rules.
- [ ] Profile-level shelf performance can be recomputed from history.
- [ ] Recent content exposure is efficiently queryable for reranking/deduplication.
- [ ] Concept fatigue/cooldown can be derived and supplied to #208.
- [ ] Recommendation Home/session identity supports cross-shelf deduplication.
- [ ] Model/query/embedding versions are stored for reproducibility.
- [ ] Lab can inspect real shelf history and score/outcome traces.
- [ ] Data growth/retention strategy exists.

## Completion rule
Do not close because tables exist. Generate and display several real shelves for a test Profile, interact with different items, and prove the Lab/history can reconstruct: which concept was shown, item ordering/scores, visibility, which item was opened/played, and the resulting profile-level performance/exposure state.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All 15 tasks complete with zero TypeScript errors in source files. Here's a summary of everything implemented:

---

## T106 Implementation — Summary

### Files created (12)

| File | Purpose |
|------|---------|
| `packages/api-contracts/src/shelf-instances.ts` | Types: `ShelfInstanceDetail`, `ShelfInstanceItemDetail`, `ConceptPerformance`, `FatigueState`, `ProfileMediaExposureEntry`, `ShelfHistoryEntry`, `ShelfInstanceTrace`, `PersistShelfInstanceParams` |
| `apps/api/src/db/schema/shelf-instances.ts` | `shelfInstances` + `shelfInstanceItems` tables with indexes |
| `apps/api/src/db/schema/recommendation-home-sessions.ts` | `recommendationHomeSessions` table |
| `apps/api/src/db/schema/shelf-concept-fatigue.ts` | `shelfConceptFatigue` table (unique on profileId+conceptId) |
| `apps/api/src/db/schema/profile-media-exposure.ts` | `profileMediaExposure` table (unique on profileId+mediaType+mediaId) |
| `apps/api/migrations/0040_t106_shelf_history.sql` | DDL for all 5 new tables + `shelf_instance_id` column on events |
| `apps/api/src/services/shelf-fatigue-service.ts` | `getFatigueStates`, `recordImpression` (with auto-cooldown), `recordInteraction`, `suppressConcept` |
| `apps/api/src/services/shelf-instance-service.ts` | `persistShelfInstance`, `markFirstDisplayed`, `markItemVisible`, `markItemOpened`, `markItemPlayed`, `getShelfInstanceWithItems`, `listProfileShelfInstances` |
| `apps/api/src/services/shelf-performance-service.ts` | `getConceptPerformance`, `getProfileMediaExposureBatch`, `getRecentlyExposedMediaIds` |
| `apps/api/src/routes/shelf-instances.ts` | `GET /shelf-instances/:id`, `GET /profiles/:profileId/shelf-instances`, `GET /profiles/:profileId/shelf-concepts/:conceptId/performance` |

### Files modified (9)

| File | Change |
|------|--------|
| `packages/api-contracts/src/index.ts` | Export `shelf-instances.js` |
| `packages/api-contracts/src/interaction-events.ts` | Add `SHELF_ITEM_VISIBLE` event type + `shelfInstanceId` field |
| `apps/api/src/db/schema/profile-interaction-events.ts` | Add nullable `shelfInstanceId` column |
| `apps/api/src/db/schema/index.ts` | Export 4 new schema files |
| `apps/api/src/config/env.ts` | Add `FATIGUE_*` and `EXPOSURE_MEMORY_HOURS` env vars |
| `apps/api/src/services/shelf-concept-generator-service.ts` | `getActivePool` filters concepts on cooldown via `ShelfFatigueService` |
| `apps/api/src/services/recommendation-ranking-service.ts` | Export `resolveImplicitShownIds`; wire `profileMediaExposure` |
| `apps/api/src/services/interaction-event-service.ts` | Add `SHELF_ITEM_VISIBLE`; non-blocking side-effect dispatch for SHELF_IMPRESSION/ITEM_VISIBLE/ITEM_OPENED/PLAY_STARTED with 30-min attribution fallback |
| `apps/api/src/routes/recommendation-lab.ts` | Import services; resolve implicit shown IDs from exposure memory; add `/shelf-history` and `/shelf-instances/:id/trace` Lab endpoints |
| `apps/api/src/index.ts` | Register `shelfInstancesRoutes` |

---

## Review

---

## PR Review — T106

### Résumé

L'infrastructure est bien construite : schémas DB corrects, services cohérents, routes Lab fonctionnelles, migration SQL alignée. Cependant, **deux problèmes bloquants** rendent le ticket non livrable.

---

### Points validés

- Schémas `shelfInstances`, `shelfInstanceItems`, `recommendationHomeSessions`, `shelfConceptFatigue`, `profileMediaExposure` corrects avec indexes et FKs conformes au plan
- `ShelfInstanceService` : transaction sur `persistShelfInstance`, COALESCE côté DB pour l'idempotence de `markFirstDisplayed`
- Attribution 30 min pour `PLAY_STARTED` : correcte et bornée
- `SHELF_ITEM_VISIBLE` ajouté à `ALLOWED_EVENT_TYPES` et dispatché
- Side-effects non-bloquants (erreurs loguées, pas propagées)
- Filtre fatigue wired dans `getActivePool()`
- Routes Lab (`/shelf-history`, `/trace`) bien structurées
- Auth : `shelfInstancesRoutes` sous `protectedApp` — protégé

---

### Problèmes bloquants

**1. `persistShelfInstance` n'est jamais appelé dans le pipeline réel**

`home-service.ts` appelle `rankRecommendations()` (l'ancienne fonction) sans jamais créer de `ShelfInstance`. Aucun fichier hors de la définition du service n'appelle `persistShelfInstance`. Résultat : zéro ligne `shelf_instances` ne sera créée lors d'une vraie session utilisateur — tous les endpoints Lab retourneront des listes vides, et l'attribution via `shelfInstanceId` dans les events sera impossible.

La completion rule du ticket exige de prouver l'end-to-end — ce n'est pas possible dans l'état actuel.

**Correction requise :** Intégrer l'appel dans `buildHome()` / `rankRecommendations()` et retourner le `shelfInstanceId` dans la réponse HTTP.

**2. `FATIGUE_LOOKBACK_DAYS` non utilisé — le streak n'est pas borné dans le temps**

La variable est définie dans `env.ts` mais n'est pas importée dans `shelf-fatigue-service.ts`. Le `zeroInteractionStreakCount` est un compteur global sans fenêtre temporelle : des impressions ignorées il y a 6 mois contribuent au cooldown autant que celles d'aujourd'hui. Déviation significative par rapport au plan.

---

### Problèmes non-bloquants

- N+1 queries dans `/shelf-history` : `getConceptPerformance()` appelé une fois par instance (2 requêtes chacun) — à batcher
- `impressionCount` dans `getConceptPerformance` compte les instances générées, pas les affichées — fausse `visibleRate`
- Cursor pagination `before` : timestamp ISO avec `+02:00` sera URL-décodé en espace → `new Date()` invalide

---

**Décision :** `IMPLEMENTATION_FIX_REQUIRED`

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T106/reviews/implementation-review.md
- generated at: 2026-08-18T12:49:07Z

---

I have all the information needed to write the review. Both blocking issues from review-attempt-1 are confirmed unresolved.

---

# PR Review — T106: Persist ShelfConcept/ShelfInstance history and item-level feedback (attempt #2)

## Résumé

Il s'agit du second passage de review. L'infrastructure DB/service est bien construite et inchangée depuis la première review. **Les deux problèmes bloquants identifiés lors du premier passage n'ont pas été corrigés.** L'implémentation ne peut pas être approuvée dans cet état.

---

## Vérifications effectuées

- Relecture de `home-service.ts` pour vérifier l'intégration de `persistShelfInstance`
- Recherche globale (`grep -rn`) de tous les appelants de `persistShelfInstance` hors du fichier de définition
- Lecture complète de `shelf-fatigue-service.ts` pour vérifier l'usage de `FATIGUE_LOOKBACK_DAYS`
- Vérification dans `env.ts` que `FATIGUE_LOOKBACK_DAYS` est bien défini (ligne 116) mais pas importé dans le service
- Lecture des routes Lab (`/shelf-history`, `/trace`) pour vérifier leur fonctionnement
- Comparaison avec le contenu de `runs/T106/reviews/review-attempt-1.md` et `runs/T106/reviews/implementation-review.md`

---

## Points validés (inchangés depuis review-attempt-1)

- Schémas corrects : `shelfInstances`, `shelfInstanceItems`, `recommendationHomeSessions`, `shelfConceptFatigue`, `profileMediaExposure` avec les bons champs, indexes, FKs — cohérents avec la migration SQL
- `ShelfInstanceService` : transaction sur `persistShelfInstance`, COALESCE idempotent pour `markFirstDisplayed`, upsert correct sur `profileMediaExposure` dans `markItemOpened`/`markItemPlayed`
- Attribution 30 min pour `PLAY_STARTED` : correcte, bornée, fallback via `SHELF_ITEM_OPENED` récent
- `SHELF_ITEM_VISIBLE` correctement ajouté à `ALLOWED_EVENT_TYPES` et dispatché
- Side-effects non-bloquants dans `dispatchSideEffects` — erreurs loguées, pas propagées
- Filtre fatigue correctement wired dans `getActivePool()`
- Routes Lab `/shelf-history` et `/trace` bien structurées, auth protégée
- `shelfInstancesRoutes` enregistré sous `protectedApp`
- Contrats API complets (`ShelfInstanceDetail`, `ConceptPerformance`, `FatigueState`, etc.)
- `/shelf-history` batchifie `getFatigueStates` et `conceptRows` — bon

---

## Problèmes détectés

### 🚨 BLOQUANT #1 — `persistShelfInstance` toujours pas appelé dans le pipeline de génération

**Fichier concerné :** `apps/api/src/services/home-service.ts`

Le fichier est identique à sa version pré-T106. `buildHome()` appelle `rankRecommendations()` puis construit et retourne le `HomeResponse` sans jamais créer de `ShelfInstance`. La recherche globale confirme que `persistShelfInstance` n'est appelé nulle part hors de sa propre définition :

```
Callers trouvés hors shelf-instance-service.ts :
  recommendation-lab.ts   → lecture seulement (getShelfInstanceWithItems, listProfileShelfInstances)
  shelf-instances.ts      → lecture seulement
  interaction-event-service.ts → markFirstDisplayed, markItemVisible, markItemOpened, markItemPlayed — jamais persistShelfInstance
```

Résultat : zéro ligne `shelf_instances` ne sera créée lors d'une vraie session utilisateur. Les endpoints Lab retourneront systématiquement des listes vides. Le `shelfInstanceId` que les clients devraient inclure dans leurs events (`SHELF_IMPRESSION`, `SHELF_ITEM_OPENED`, etc.) n'existe pas car personne ne le génère.

La completion rule du ticket est explicite :
> "Generate and display several real shelves for a test Profile, interact with different items, and **prove** the Lab/history can reconstruct..."

Ceci ne peut pas être démontré.

**Correction requise :** Appeler `ShelfInstanceService.persistShelfInstance()` dans `buildHome()` au moment où les items rankés sont connus, et retourner le `shelfInstanceId` dans le `ShelfResponse` pour que le client puisse l'inclure dans ses events.

---

### 🚨 BLOQUANT #2 — `FATIGUE_LOOKBACK_DAYS` défini mais jamais utilisé

**Fichier concerné :** `apps/api/src/services/shelf-fatigue-service.ts`

`env.ts` ligne 116 exporte `FATIGUE_LOOKBACK_DAYS = 14` (par défaut). `shelf-fatigue-service.ts` n'importe que `FATIGUE_MAX_ZERO_INTERACTION_STREAK`, `FATIGUE_COOLDOWN_DAYS`, `FATIGUE_SUPPRESSION_VERSION` — `FATIGUE_LOOKBACK_DAYS` n'est pas importé et n'apparaît nulle part dans le fichier.

Conséquence : le `zeroInteractionStreakCount` est un compteur global incrémental sans borne temporelle. Des impressions ignorées il y a 6 mois pèsent autant que celles de la semaine dernière. Un utilisateur avec 4 impressions ignorées il y a 4 mois et 1 today atteint le seuil et est mis en cooldown — comportement incorrect par rapport au plan.

**Correction minimale requise :** Soit (a) implémenter une vraie fenêtre temporelle en requêtant les ShelfInstances récents pour compter les impressions sans interaction dans `FATIGUE_LOOKBACK_DAYS`, soit (b) réinitialiser `zeroInteractionStreakCount` à 0 quand `lastShownAt < now - FATIGUE_LOOKBACK_DAYS` au moment de l'upsert, soit (c) documenter explicitement dans le code que la fenêtre n'est pas implémentée et que c'est un choix délibéré (déviation de plan assumée).

---

### ⚠️ Significatif (inchangé depuis review-attempt-1) — N+1 queries dans `/shelf-history`

**Fichier :** `apps/api/src/routes/recommendation-lab.ts:643-647`

`getConceptPerformance()` est toujours appelé une fois par instance via `Promise.all()`. Les requêtes sont concurrentes (mieux que le premier review ne l'indiquait), mais c'est toujours N × 2 requêtes DB pour une page de 20 shelves avec des conceptIds distincts, en plus des requêtes déjà faites pour `conceptRows` et `fatigueMap`. Pour un Lab de diagnostic, acceptable en l'état si les deux bloquants sont résolus, mais à batcher dans un suivi.

---

### ⚠️ Significatif (inchangé) — `impressionCount` compte les instances générées, pas affichées

**Fichier :** `apps/api/src/services/shelf-performance-service.ts`

`impressionCount = instances.length` inclut les ShelfInstances avec `firstDisplayedAt = null`, ce qui fausse `visibleRate` à la baisse. À corriger ou à documenter.

---

### ⚠️ Mineur (inchangé) — Cursor pagination `before` sensible à l'URL-encoding

**Fichier :** `apps/api/src/services/shelf-instance-service.ts:293`

Un timestamp ISO avec timezone (`+02:00`) dont le `+` est décodé comme espace invalide `new Date(before)` sans décoder l'URL explicitement.

---

## Risques éventuels

- `shownInConceptIds` (jsonb array) croît sans borne — à surveiller pour les media très exposés.
- Race condition bénigne dans `recordImpression` (upsert + check de seuil en deux requêtes séparées) — doublon d'écriture idempotent, pas de corruption.
- `getConceptPerformance` charge tous les ShelfInstanceItems d'un concept en mémoire — acceptable à court terme, indexé.

---

## Décision

Les deux corrections bloquantes identifiées lors du premier passage n'ont pas été réalisées. L'infrastructure est correcte mais inutilisable en production : aucun `ShelfInstance` ne sera jamais créé, et la fenêtre temporelle de fatigue n'est pas respectée.

IMPLEMENTATION_FIX_REQUIRED