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


# T105 — Generate personalized shelf concepts with LLM using profile taste and exploration strategy

**Source**: GitHub Issue #208

## Description

## Context
#203 captures rich profile behavior, #205 provides semantic retrieval, #206 provides LLM intent planning and #207 provides hybrid reranking. We now need the layer that decides WHICH shelves should exist for a Profile.

The LLM should act like an editorial concept generator informed by profile taste/history, not like the final movie selector.

## Goal
Generate a diverse set of personalized shelf concepts from compact profile/taste context, recent activity, previously shown shelf history and product exploration rules.

Example concepts:
- `SF qui fait réfléchir`
- `Quand l'intelligence artificielle nous dépasse`
- `Dans la lignée de Denis Villeneuve`
- `Thrillers en huis clos où personne n'est fiable`
- `Anime à binge-watcher`
- `Nouveautés proches de vos goûts`

Each concept must then flow through #206 -> #205/#207 to produce actual catalog items.

## 1. ShelfConcept model
Create a durable/versioned shelf concept representation, e.g.:
```text
ShelfConcept
- id
- profileId nullable for global/editorial concepts
- title
- rawIntent
- semanticIntent / query seed
- generationType (PERSONALIZED / EXPLORATION / DISCOVERY / FIXED / EDITORIAL)
- reasonCodes / generationReasons
- sourceModel
- promptVersion
- createdAt
- expiresAt / freshness window
- active
```

The exact schema should fit existing #203 groundwork and must not duplicate ShelfInstance history from the dedicated history ticket.

## 2. Compact profile context
Build a bounded context for concept generation from derived taste data, not a giant raw history dump.

Include useful summaries such as:
- top genres/themes;
- actors/directors/creators affinity;
- movie/series/anime balance;
- runtime/language preferences;
- recent completions;
- recent likes/dislikes/abandons;
- current My List themes;
- binge tendencies;
- recent shelf concepts shown and their performance;
- currently available/new catalog signals where useful.

Do not send secrets or raw provider URLs.

## 3. Exploration/exploitation mix
Support configurable generation mix, initially something like:
- ~70% personalized/exploitation;
- ~20% adjacent exploration;
- ~10% broad discovery/trending/editorial.

These ratios must be configuration, not hard-coded product truth.

Avoid filter bubbles while still making Home feel personal.

## 4. Avoid repetitive concepts
Use recent ShelfConcept/ShelfInstance history to penalize:
- identical titles/intents;
- near-duplicate semantic concepts;
- repeatedly ignored concepts;
- repeated use of the same single watched title as anchor;
- endless genre-only shelves.

Concept novelty should be measured semantically where possible, not only by exact title string.

## 5. Performance feedback
Feed aggregated shelf performance back into future concept generation, e.g.:
- shelf reached/visible;
- shelf item open rate;
- play rate;
- meaningful watch/completion after play;
- ignored shelf;
- explicit negative/dismissal signals if available.

The LLM should receive a summarized performance view, while deterministic rules should also enforce suppression of consistently poor concepts.

## 6. Cold-start behavior
For a new/empty Profile, generate useful shelves from:
- popular/trending catalog;
- genres/content-type starter mix;
- household availability;
- explicit profile language/kids settings;
- optional onboarding preferences if added later.

Do not hallucinate a detailed TasteProfile for a new profile.

## 7. LLM output schema
Require strict structured output per proposed shelf including:
- display title;
- raw recommendation intent;
- generation type;
- generation reason;
- optional anchor media/people IDs only when these IDs are supplied in context;
- desired content type;
- optional freshness/availability policy.

LLM must not return final authoritative content IDs from memory.

## 8. Concept validation
Before persisting/using a concept:
- validate schema;
- reject unsafe/empty/nonsensical concepts;
- check it is not semantically too close to recent shelves;
- dry-run retrieval to ensure enough viable candidates exist;
- discard concepts that cannot produce a healthy shelf.

## 9. Batch generation/cache
Generate concepts in batches, e.g. enough for dozens of future shelves, and cache them per Profile.

Do not call the LLM every time the user scrolls one screen.

Refresh when:
- pool is low;
- taste changed materially;
- concepts become stale;
- repeated poor performance warrants regeneration.

## 10. Lab support
Add a Lab page/panel that can:
- choose a Profile;
- inspect compact taste context;
- ask `Generate shelf concepts`;
- show generated concepts + reasons/types;
- preview each concept through the recommendation pipeline;
- flag concepts as good/bad manually for development.

## Acceptance criteria
- [ ] LLM can generate structured personalized shelf concepts from compact profile context.
- [ ] Final content selection remains delegated to retrieval/ranking.
- [ ] Concept generation supports personalized/exploration/discovery modes.
- [ ] Recent shelf history reduces repetitive concepts.
- [ ] Poor-performing/ignored concepts can influence future generation.
- [ ] Cold-start profiles receive sensible non-hallucinated concepts.
- [ ] Concepts are validated against real catalog candidate availability before use.
- [ ] Concepts are batch-generated/cached rather than generated on every scroll.
- [ ] Lab can inspect profile context and preview generated shelves.
- [ ] Model/prompt/version/reason provenance is persisted.

## Completion rule
Do not close because the LLM generated 20 strings. For at least two Profiles with different taste histories, generate materially different concept sets, run multiple concepts through the real retrieval/ranking pipeline, and demonstrate that weak/duplicate concepts are filtered before reaching Home.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

No type errors in the web package. All 14 tests pass, and both packages type-check cleanly (only pre-existing errors unrelated to T105).

T105 implementation is complete and verified:
- **14/14 service tests pass** — all mock chain fixes worked
- **Web TypeScript clean** — `RecommendationLabPage.tsx` and `api.ts` additions are type-safe
- **API TypeScript** — only pre-existing errors, nothing from the new shelf-concepts code

---

## Review

Now I have all the information needed to write the full review.

---

# PR Review — T105 Generate personalized shelf concepts with LLM

## Résumé

L'implémentation couvre correctement la grande majorité du ticket : schéma DB complet, service de génération LLM, validation de concepts, cache/TTL, dedup sémantique intra-batch, contexte profil compact, gestion cold-start, config env, routes REST et UI Lab. La structure est propre, les tests unitaires couvrent les chemins critiques et les types sont end-to-end type-safe.

Trois problèmes bloquants ont été identifiés, qui invalident des exigences explicites du ticket (§4, §9) ou risquent de produire des comportements silencieusement défaillants en production.

---

## Vérifications effectuées

- Lecture complète du service `shelf-concept-generator-service.ts` (537 lignes)
- Vérification du schéma Drizzle et de la migration SQL
- Lecture des contrats API, de la route et du prompt LLM
- Vérification de la logique `needsRefresh` / `getActivePool` / `validateConcept`
- Lecture de `RecommendationLabPage.tsx` (tab ShelfConceptsTab)
- Lecture des 14 tests unitaires
- Vérification des configs env (`SHELF_CONCEPT_*`)

---

## Points validés

- **Schéma DB** : tous les champs requis par le ticket (id, profileId nullable, title, rawIntent, semanticIntent, generationType enum, reasonCodes, sourceModel, promptVersion, expiresAt, active, compteurs de performance). Migration SQL cohérente avec le schéma Drizzle. Index composite `(profileId, active, createdAt)` présent.
- **Contracts API** : `ShelfConcept`, `ShelfConceptProfileContext`, `GenerateShelfConceptsBody/Response`, `ShelfConceptFeedbackBody` — types complets et exportés correctement.
- **Prompt LLM** : système + user clairement séparés. Format JSON strict, règles de variété (thématique, directorial, mood), interdiction d'inventer des IDs ou titres, règles cold-start. Les données personnelles sont filtrées du contexte cold-start avant envoi.
- **Ratios exploration/exploitation** : entièrement config-driven, normalisés au runtime, warning si la somme ≠ 1.
- **Dedup intra-batch** : cosine similarity sur embeddings (seuil 0.85) dans `generateConcepts`. Correct.
- **Dry-run retrieval** : rejet si `< 3` candidats retournés. Correct.
- **Validation de concept** : schema (champs vides, enum), type media, freshnessPolicy, concepts ignorés (persistently dismissed). Logique claire.
- **Cold-start** : `signalCount < 3` → contexte vide de signaux personnels, only catalog signals + langue + kids.
- **Cache** : `needsRefresh` sur pool size, TTL, taste rebuild. LLM non appelé si pool frais.
- **Lab UI** : onglet "Concepts de rayons" avec profile picker, context panel collapsible, concept cards (badge type, reasonCodes, mediaTypes, freshnessPolicy, model/prompt), prévisualisation via semantic search, feedback Bon/Mauvais + toast.
- **Tests** : 14 tests couvrant buildProfileContext warm/cold, validateConcept failures/success, needsRefresh, generateConcepts (2 profiles distincts, dry-run < 3, cosine dedup, no OpenAI).
- **Provenance** : `sourceModel`, `promptVersion` persistés sur chaque concept.

---

## Problèmes détectés

### Bloquant 1 — `getActivePool` ne filtre pas les concepts expirés

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:461-469`

```ts
async getActivePool(profileId: string): Promise<ShelfConcept[]> {
  const rows = await this.db
    .select()
    .from(shelfConcepts)
    .where(and(eq(shelfConcepts.profileId, profileId), eq(shelfConcepts.active, true)))
    // ← expiresAt jamais vérifié
    .orderBy(desc(shelfConcepts.createdAt))
  return rows.map((r) => this.toApiModel(r))
}
```

Le champ `expiresAt` est correctement renseigné à l'insert (`Date.now() + TTL_HOURS * 3600 * 1000`) mais n'est jamais utilisé dans les requêtes. Les concepts expirés restent dans le pool actif indéfiniment. Cela casse le critère §9 "Refresh when: concepts become stale".

`needsRefresh` compare `createdAt` du concept le plus récent au TTL, mais retourne `false` si le pool a ≥ 8 concepts, même si tous ont expiré. Les concepts expirés sont donc servis en production sans jamais être raffraîchis.

**Correction** : ajouter `or(isNull(shelfConcepts.expiresAt), gte(shelfConcepts.expiresAt, sql\`NOW()\`))` dans le `where` de `getActivePool`.

---

### Bloquant 2 — `max_tokens: 4000` trop faible pour les batchs complets

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:342-348`

```ts
const response = await this.openai.chat.completions.create({
  model: this.model,
  response_format: { type: 'json_object' },
  temperature: 0.7,
  max_tokens: 4000,
  messages,
})
```

Un concept avec un `semanticIntent` de 3-5 phrases représente environ 80-150 tokens. Avec les autres champs (title, rawIntent, reasonCodes, desiredMediaTypes, freshnessPolicy), chaque objet pèse ~150-250 tokens. Un batch de 20 concepts = ~3000-5000 tokens de contenu brut, sans compter l'overhead JSON et les balises.

En pratique, la réponse sera tronquée sur les batchs complets, produisant un JSON invalide. Le code catch la parse error et retourne silencieusement `[]` avec un simple `console.warn` — l'appelant reçoit un pool vide sans erreur claire.

**Correction** : porter `max_tokens` à `8000` minimum pour les batchs de 20 concepts. Ou mieux, utiliser `max_completion_tokens` et ajuster en fonction du `count` demandé (`count * 300` tokens de marge).

---

### Bloquant 3 — Dedup sémantique contre le pool DB existant est text-prefix, non embedding-based

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:300-308`

```ts
// Reject concepts too similar to persistently ignored ones
const ignoredConcepts = existingConcepts.filter((c) => c.dismissCount > c.openCount * 2)
const intentPrefix = concept.semanticIntent.toLowerCase().slice(0, 30)
for (const ignored of ignoredConcepts) {
  if (ignored.semanticIntent.toLowerCase().includes(intentPrefix)) {
    return { valid: false, reason: `too similar to ignored concept: ${ignored.title}` }
  }
}
```

Le ticket §4 dit explicitement : **"Concept novelty should be measured semantically where possible, not only by exact title string."**

Le dedup cosine (embedding) est appliqué uniquement intra-batch (concepts générés dans le même appel LLM). Pour les concepts déjà en DB (batches précédents), le filtre utilise une comparaison de substring sur les 30 premiers caractères — facile à contourner par une reformulation légèrement différente.

Deux batches successifs peuvent donc persister des concepts sémantiquement identiques si leurs `semanticIntent` n'ont pas le même préfixe. Le critère §8 "check it is not semantically too close to recent shelves" n'est pas respecté pour les batches successifs.

**Correction** : dans `generateConcepts`, initialiser `sessionEmbeddings` avec les embeddings des concepts existants en DB (si l'embedding provider est disponible). Cela permet le même test cosine contre le pool DB avant de comparer intra-batch.

---

## Risques éventuels

### Mineur A — `runtimePreference` hardcodé à `'mixed'`

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:252,261`

Le plan prévoyait de dériver `runtimePreference` depuis les durées médianes complétées vs abandonnées. Le champ est présent dans `ShelfConceptProfileContext` mais retourne toujours `'mixed'`. Cela prive le LLM d'un signal utile (ex: profil qui abandonne systématiquement les films > 2h).

Non bloquant car la fonctionnalité n'est pas dans les acceptance criteria du ticket, mais le champ "menteur" peut induire en erreur lors du debug.

---

### Mineur B — `buildProfileContext` appelé deux fois dans `POST /generate`

**Fichier** : `apps/api/src/routes/shelf-concepts.ts:46-58`

```ts
const needsRefresh = await service.needsRefresh(profileId)
let concepts
if (!needsRefresh) {
  concepts = await service.getActivePool(profileId)
} else {
  concepts = await service.generateConcepts(profileId, { count })  // appelle buildProfileContext en interne
}
const profileContext = await service.buildProfileContext(profileId)  // 2e appel
```

Lorsque `generateConcepts` est déclenché, `buildProfileContext` est appelé deux fois (une fois dans `generateConcepts`, une fois après pour la réponse), doublant les requêtes DB de construction de contexte. À corriger en faisant retourner le contexte par `generateConcepts` ou en passant le contexte déjà construit.

---

### Mineur C — `applyFeedback('good')` incrémente `openCount`

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:501-503`

Le signal Lab "good" incrémente `openCount`, qui sera par ailleurs utilisé pour calculer `openRate` dans `recentShelfConcepts` du contexte profil. Les votes manuels Lab vont polluer la métrique `openRate` avec des signaux non-événementiels. Quand la production alimentera `openCount` via des vrais events d'interaction, il ne sera plus possible de distinguer les votes Lab des vraies ouvertures.

Suggère de mapper `good` → `likeCount` (nouveau compteur dédié) ou d'ajouter un boolean `labFeedback` séparé pour isoler les votes manuels.

---

### Mineur D — Pas de filtre `expiresAt` sur la table dans `needsRefresh`

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:471-498`

`needsRefresh` appelle `getActivePool` qui (voir Bloquant 1) inclut les concepts expirés. Si le pool a ≥ 8 concepts expirés, `needsRefresh` retourne `false` — aucune régénération n'est déclenchée même si tous les concepts ont expiré. Ce problème est une conséquence directe du Bloquant 1.

---

## Décision

REQUEST_CHANGES — trois corrections bloquantes requises avant merge.

## Actions demandées

1. **[Bloquant 1]** Dans `getActivePool`, ajouter un filtre sur `expiresAt` pour exclure les concepts expirés : `or(isNull(shelfConcepts.expiresAt), gte(shelfConcepts.expiresAt, sql\`NOW()\`))`.

2. **[Bloquant 2]** Dans l'appel OpenAI de `generateConcepts`, porter `max_tokens` à `8000` (ou calculer dynamiquement `count * 350` avec un plancher de 4000). S'assurer que le log d'erreur de parse JSON est au niveau `error` et non `warn`, et qu'un compteur/metric permet de détecter les truncations en production.

3. **[Bloquant 3]** Dans `generateConcepts`, avant la boucle intra-batch, pré-charger les embeddings des concepts existants en DB (`existingConcepts`) pour les inclure dans `sessionEmbeddings` initiale. Cela étend le dedup cosine au pool DB complet, conformément à la requirement §4 et §8 du ticket.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T105/reviews/implementation-review.md
- generated at: 2026-08-18T11:49:26Z

---

Now I have all the information needed to write the full review.

---

# PR Review — T105 Generate personalized shelf concepts with LLM

## Résumé

L'implémentation couvre correctement la grande majorité du ticket : schéma DB complet, service de génération LLM, validation de concepts, cache/TTL, dedup sémantique intra-batch, contexte profil compact, gestion cold-start, config env, routes REST et UI Lab. La structure est propre, les tests unitaires couvrent les chemins critiques et les types sont end-to-end type-safe.

Trois problèmes bloquants ont été identifiés, qui invalident des exigences explicites du ticket (§4, §9) ou risquent de produire des comportements silencieusement défaillants en production.

---

## Vérifications effectuées

- Lecture complète du service `shelf-concept-generator-service.ts` (537 lignes)
- Vérification du schéma Drizzle et de la migration SQL
- Lecture des contrats API, de la route et du prompt LLM
- Vérification de la logique `needsRefresh` / `getActivePool` / `validateConcept`
- Lecture de `RecommendationLabPage.tsx` (tab ShelfConceptsTab)
- Lecture des 14 tests unitaires
- Vérification des configs env (`SHELF_CONCEPT_*`)

---

## Points validés

- **Schéma DB** : tous les champs requis par le ticket (id, profileId nullable, title, rawIntent, semanticIntent, generationType enum, reasonCodes, sourceModel, promptVersion, expiresAt, active, compteurs de performance). Migration SQL cohérente avec le schéma Drizzle. Index composite `(profileId, active, createdAt)` présent.
- **Contracts API** : `ShelfConcept`, `ShelfConceptProfileContext`, `GenerateShelfConceptsBody/Response`, `ShelfConceptFeedbackBody` — types complets et exportés correctement.
- **Prompt LLM** : système + user clairement séparés. Format JSON strict, règles de variété (thématique, directorial, mood), interdiction d'inventer des IDs ou titres, règles cold-start. Les données personnelles sont filtrées du contexte cold-start avant envoi.
- **Ratios exploration/exploitation** : entièrement config-driven, normalisés au runtime, warning si la somme ≠ 1.
- **Dedup intra-batch** : cosine similarity sur embeddings (seuil 0.85) dans `generateConcepts`. Correct.
- **Dry-run retrieval** : rejet si `< 3` candidats retournés. Correct.
- **Validation de concept** : schema (champs vides, enum), type media, freshnessPolicy, concepts ignorés (persistently dismissed). Logique claire.
- **Cold-start** : `signalCount < 3` → contexte vide de signaux personnels, only catalog signals + langue + kids.
- **Cache** : `needsRefresh` sur pool size, TTL, taste rebuild. LLM non appelé si pool frais.
- **Lab UI** : onglet "Concepts de rayons" avec profile picker, context panel collapsible, concept cards (badge type, reasonCodes, mediaTypes, freshnessPolicy, model/prompt), prévisualisation via semantic search, feedback Bon/Mauvais + toast.
- **Tests** : 14 tests couvrant buildProfileContext warm/cold, validateConcept failures/success, needsRefresh, generateConcepts (2 profiles distincts, dry-run < 3, cosine dedup, no OpenAI).
- **Provenance** : `sourceModel`, `promptVersion` persistés sur chaque concept.

---

## Problèmes détectés

### Bloquant 1 — `getActivePool` ne filtre pas les concepts expirés

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:461-469`

```ts
async getActivePool(profileId: string): Promise<ShelfConcept[]> {
  const rows = await this.db
    .select()
    .from(shelfConcepts)
    .where(and(eq(shelfConcepts.profileId, profileId), eq(shelfConcepts.active, true)))
    // ← expiresAt jamais vérifié
    .orderBy(desc(shelfConcepts.createdAt))
  return rows.map((r) => this.toApiModel(r))
}
```

Le champ `expiresAt` est correctement renseigné à l'insert (`Date.now() + TTL_HOURS * 3600 * 1000`) mais n'est jamais utilisé dans les requêtes. Les concepts expirés restent dans le pool actif indéfiniment. Cela casse le critère §9 "Refresh when: concepts become stale".

`needsRefresh` compare `createdAt` du concept le plus récent au TTL, mais retourne `false` si le pool a ≥ 8 concepts, même si tous ont expiré. Les concepts expirés sont donc servis en production sans jamais être raffraîchis.

**Correction** : ajouter `or(isNull(shelfConcepts.expiresAt), gte(shelfConcepts.expiresAt, sql\`NOW()\`))` dans le `where` de `getActivePool`.

---

### Bloquant 2 — `max_tokens: 4000` trop faible pour les batchs complets

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:342-348`

```ts
const response = await this.openai.chat.completions.create({
  model: this.model,
  response_format: { type: 'json_object' },
  temperature: 0.7,
  max_tokens: 4000,
  messages,
})
```

Un concept avec un `semanticIntent` de 3-5 phrases représente environ 80-150 tokens. Avec les autres champs (title, rawIntent, reasonCodes, desiredMediaTypes, freshnessPolicy), chaque objet pèse ~150-250 tokens. Un batch de 20 concepts = ~3000-5000 tokens de contenu brut, sans compter l'overhead JSON et les balises.

En pratique, la réponse sera tronquée sur les batchs complets, produisant un JSON invalide. Le code catch la parse error et retourne silencieusement `[]` avec un simple `console.warn` — l'appelant reçoit un pool vide sans erreur claire.

**Correction** : porter `max_tokens` à `8000` minimum pour les batchs de 20 concepts. Ou mieux, utiliser `max_completion_tokens` et ajuster en fonction du `count` demandé (`count * 300` tokens de marge).

---

### Bloquant 3 — Dedup sémantique contre le pool DB existant est text-prefix, non embedding-based

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:300-308`

```ts
// Reject concepts too similar to persistently ignored ones
const ignoredConcepts = existingConcepts.filter((c) => c.dismissCount > c.openCount * 2)
const intentPrefix = concept.semanticIntent.toLowerCase().slice(0, 30)
for (const ignored of ignoredConcepts) {
  if (ignored.semanticIntent.toLowerCase().includes(intentPrefix)) {
    return { valid: false, reason: `too similar to ignored concept: ${ignored.title}` }
  }
}
```

Le ticket §4 dit explicitement : **"Concept novelty should be measured semantically where possible, not only by exact title string."**

Le dedup cosine (embedding) est appliqué uniquement intra-batch (concepts générés dans le même appel LLM). Pour les concepts déjà en DB (batches précédents), le filtre utilise une comparaison de substring sur les 30 premiers caractères — facile à contourner par une reformulation légèrement différente.

Deux batches successifs peuvent donc persister des concepts sémantiquement identiques si leurs `semanticIntent` n'ont pas le même préfixe. Le critère §8 "check it is not semantically too close to recent shelves" n'est pas respecté pour les batches successifs.

**Correction** : dans `generateConcepts`, initialiser `sessionEmbeddings` avec les embeddings des concepts existants en DB (si l'embedding provider est disponible). Cela permet le même test cosine contre le pool DB avant de comparer intra-batch.

---

## Risques éventuels

### Mineur A — `runtimePreference` hardcodé à `'mixed'`

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:252,261`

Le plan prévoyait de dériver `runtimePreference` depuis les durées médianes complétées vs abandonnées. Le champ est présent dans `ShelfConceptProfileContext` mais retourne toujours `'mixed'`. Cela prive le LLM d'un signal utile (ex: profil qui abandonne systématiquement les films > 2h).

Non bloquant car la fonctionnalité n'est pas dans les acceptance criteria du ticket, mais le champ "menteur" peut induire en erreur lors du debug.

---

### Mineur B — `buildProfileContext` appelé deux fois dans `POST /generate`

**Fichier** : `apps/api/src/routes/shelf-concepts.ts:46-58`

```ts
const needsRefresh = await service.needsRefresh(profileId)
let concepts
if (!needsRefresh) {
  concepts = await service.getActivePool(profileId)
} else {
  concepts = await service.generateConcepts(profileId, { count })  // appelle buildProfileContext en interne
}
const profileContext = await service.buildProfileContext(profileId)  // 2e appel
```

Lorsque `generateConcepts` est déclenché, `buildProfileContext` est appelé deux fois (une fois dans `generateConcepts`, une fois après pour la réponse), doublant les requêtes DB de construction de contexte. À corriger en faisant retourner le contexte par `generateConcepts` ou en passant le contexte déjà construit.

---

### Mineur C — `applyFeedback('good')` incrémente `openCount`

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:501-503`

Le signal Lab "good" incrémente `openCount`, qui sera par ailleurs utilisé pour calculer `openRate` dans `recentShelfConcepts` du contexte profil. Les votes manuels Lab vont polluer la métrique `openRate` avec des signaux non-événementiels. Quand la production alimentera `openCount` via des vrais events d'interaction, il ne sera plus possible de distinguer les votes Lab des vraies ouvertures.

Suggère de mapper `good` → `likeCount` (nouveau compteur dédié) ou d'ajouter un boolean `labFeedback` séparé pour isoler les votes manuels.

---

### Mineur D — Pas de filtre `expiresAt` sur la table dans `needsRefresh`

**Fichier** : `apps/api/src/services/shelf-concept-generator-service.ts:471-498`

`needsRefresh` appelle `getActivePool` qui (voir Bloquant 1) inclut les concepts expirés. Si le pool a ≥ 8 concepts expirés, `needsRefresh` retourne `false` — aucune régénération n'est déclenchée même si tous les concepts ont expiré. Ce problème est une conséquence directe du Bloquant 1.

---

## Décision

REQUEST_CHANGES — trois corrections bloquantes requises avant merge.

## Actions demandées

1. **[Bloquant 1]** Dans `getActivePool`, ajouter un filtre sur `expiresAt` pour exclure les concepts expirés : `or(isNull(shelfConcepts.expiresAt), gte(shelfConcepts.expiresAt, sql\`NOW()\`))`.

2. **[Bloquant 2]** Dans l'appel OpenAI de `generateConcepts`, porter `max_tokens` à `8000` (ou calculer dynamiquement `count * 350` avec un plancher de 4000). S'assurer que le log d'erreur de parse JSON est au niveau `error` et non `warn`, et qu'un compteur/metric permet de détecter les truncations en production.

3. **[Bloquant 3]** Dans `generateConcepts`, avant la boucle intra-batch, pré-charger les embeddings des concepts existants en DB (`existingConcepts`) pour les inclure dans `sessionEmbeddings` initiale. Cela étend le dedup cosine au pool DB complet, conformément à la requirement §4 et §8 du ticket.

IMPLEMENTATION_FIX_REQUIRED