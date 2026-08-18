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


# T101 — Create standalone Recommendation Lab service and simple Web UI

**Source**: GitHub Issue #204

## Description

## Context
IPTVFlix needs a recommendation system that can be developed, queried and evaluated independently from the main product UI. We explicitly do NOT want recommendation logic buried inside the Home page or coupled to one frontend implementation.

Existing foundations:
- #201 Account -> Profile
- #203 profile-level interaction/taste data

This ticket creates the standalone LAB / SERVICE shell only. Follow-up tickets add embeddings, LLM query planning, reranking, shelf generation and Home integration.

## Goal
Create a separately deployable/queryable `recommendation-engine` plus a very small `recommendation-lab` Web UI so recommendation quality can be tested interactively before connecting it to IPTVFlix Home.

Target shape:

```text
IPTVFlix DB / catalog / profiles
          ↓
recommendation-engine
          ↑
  internal HTTP API
          ↑
recommendation-lab Web UI
```

The service should be runnable locally and deployable as a separate Railway service later.

## 1. Service boundary
Add a standalone application/package under the monorepo, e.g.:
- `apps/recommendation-engine`
- and optionally `apps/recommendation-lab`

Do not mix this into `apps/api` beyond a thin integration client later.

Define clear ownership:
- reads canonical catalog data;
- reads profile/taste/interactions when requested;
- computes/query recommendations;
- never owns playback/source credentials;
- does not become another canonical media database.

## 2. Internal API
Expose versioned internal endpoints suitable for experimentation, for example:

`POST /v1/query`

Request:
```json
{
  "text": "SF qui fait réfléchir, sombre, peu d'action, moins de 2h",
  "profileId": "optional",
  "mediaTypes": ["movie"],
  "limit": 24,
  "debug": true
}
```

Response should be designed to evolve and eventually include:
- interpreted query/plan;
- candidate IDs;
- final result IDs;
- score breakdown;
- applied filters;
- model/version metadata;
- timing metrics.

Do not expose account/provider secrets.

## 3. Recommendation Lab UI
Create a deliberately simple developer/admin Web UI, not a polished consumer UI.

Minimum screen:
- free-text query input;
- optional Profile selector/id;
- content type selector;
- limit selector;
- toggles for pipeline stages as they become available;
- Search button;
- result cards with poster/title;
- diagnostic scores/reasons;
- raw structured query/plan panel;
- timing/latency panel.

Suggested future-compatible toggles:
- LLM query expansion
- vector retrieval
- metadata filtering
- profile personalization
- hybrid reranking

If a stage is not implemented yet, show it disabled rather than faking behavior.

## 4. Comparison mode
Prepare the Lab to compare strategies side-by-side later, e.g.:
- raw text vector search;
- LLM-expanded query;
- vector + structured filters;
- full hybrid personalized ranking.

Persisting experiments is not required in this ticket but API/UI contracts should not prevent it.

## 5. Catalog access
Reuse the existing canonical catalog/database. Do not duplicate all movies/series into a new relational DB just for the Lab.

Use a repository/data-access boundary so the recommendation service can later switch between shared Postgres read access or a dedicated recommendation store without changing callers.

## 6. Profile authorization
The Lab is developer/admin tooling. If it accepts `profileId`, ensure it only reads profiles allowed by the authenticated/admin context. Do not create an insecure endpoint that lets arbitrary users inspect another account's taste/history.

## 7. Observability
Log structured, sanitized diagnostics:
- request ID;
- pipeline stage timings;
- candidate counts;
- final result count;
- failures per stage;
- model/index versions.

No raw account passwords, Xtream credentials or secret-bearing provider URLs.

## 8. Railway readiness
Provide deploy/start configuration suitable for Railway as an independent service:
- health endpoint;
- PORT binding;
- environment configuration;
- database connectivity;
- LLM/embedding provider config placeholders (not secrets committed);
- graceful startup when optional AI providers are not configured.

## Acceptance criteria
- [ ] Standalone recommendation service exists outside the main API runtime.
- [ ] Service has a health endpoint and versioned query API.
- [ ] Simple Recommendation Lab Web UI can call it.
- [ ] User can type a natural-language recommendation query and see the current baseline result path.
- [ ] Debug response can carry stage outputs/scores/version metadata.
- [ ] Pipeline stages are architected as independently switchable components.
- [ ] Catalog access reuses canonical IPTVFlix data.
- [ ] Profile access is authorization-safe.
- [ ] Local run instructions exist.
- [ ] Railway deployment config exists or is documented.
- [ ] Missing optional LLM/vector stages fail gracefully and visibly.

## Completion rule
Do not close because folders/routes exist. Run the engine + lab locally, issue at least one real query against the existing IPTVFlix catalog, render real catalog titles in the Lab, and show the diagnostic request/response path end-to-end.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation is complete and verified. Here's a summary:

---

## Files created

### `apps/recommendation-engine` (Fastify service, port 3001)
- `package.json` — `@iptvflix/recommendation-engine`, Fastify v4, drizzle-orm, postgres.js, zod
- `tsconfig.json` + `tsconfig.build.json`
- `src/config.ts` — typed env config (DATABASE_URL required, PORT/LOG_LEVEL/OPENAI_API_KEY/CORS_ORIGIN optional)
- `src/db/client.ts` — drizzle + postgres.js read-only connection
- `src/db/schema.ts` — minimal schema declarations for movies, series, profiles, mediaEmbeddings
- `src/pipeline/types.ts` — shared types: QueryRequest, QueryResponse, StageResult, CandidateItem, etc.
- `src/pipeline/pipeline.ts` — orchestrator: runs stages in sequence, collects timings, assembles response
- `src/pipeline/stages/text-search.ts` — **baseline** (always available): ILIKE + FTS via `websearch_to_tsquery('simple', ...)`
- `src/pipeline/stages/semantic-search.ts` — **stub**: checks for indexed embeddings, returns `available: false`
- `src/pipeline/stages/llm-planner.ts` — **stub**: checks OPENAI_API_KEY, returns `available: false`
- `src/routes/health.ts` — `GET /health` → `{ status, version, timestamp }`
- `src/routes/query.ts` — `POST /v1/query` with Zod validation, profileId DB authorization
- `src/index.ts` — Fastify bootstrap with CORS, structured logging, SIGTERM handler
- `railway.toml`, `.env.example`, `README.md`

### `apps/recommendation-lab` (Vite/React dev UI, port 3002)
- `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `src/api.ts` — typed engine client reading `VITE_ENGINE_URL` (default `http://localhost:3001`)
- `src/App.tsx` — layout: QueryForm → ResultGrid → DiagnosticPanel
- `src/components/QueryForm.tsx` — free-text query, profileId field, content type/limit selectors, stage pills
- `src/components/StageToggle.tsx` — green=active / grey=disabled with tooltip
- `src/components/ResultGrid.tsx` — TMDB poster cards with title, year, media type badge, score
- `src/components/DiagnosticPanel.tsx` — Timing/Stages table + Raw JSON tabs

## Verified end-to-end
- `GET /health` → `{ status: "ok", version: "1.0.0", ... }` ✅
- `POST /v1/query { text: "Movie" }` → returns "Movie One", "Movie Two" from real catalog ✅
- text-search available, llm-planner + semantic-search report `available: false` with reasons ✅
- Structured logs include `requestId`, `stage`, `durationMs`, `candidateCount`, `finalCount`, no credentials ✅
- Lab Vite server starts and serves the React app ✅
- Both TypeScript typechecks pass with zero errors ✅

---

## Review

I have all the information I need. Here is the structured review:

---

# PR Review — T101 · Standalone Recommendation Engine + Lab UI

## Résumé

L'implémentation ajoute deux applications au monorepo : `apps/recommendation-engine` (Fastify/TypeScript, port 3001) et `apps/recommendation-lab` (React/Vite, port 3002). Le service expose `GET /health` et `POST /v1/query` avec pipeline en 3 étapes (text-search disponible, semantic-search et llm-planner en stub). Le Lab UI permet la saisie de requêtes, l'affichage des résultats et un panneau diagnostique. La structure est propre et l'architecture respecte le périmètre du ticket.

## Vérifications effectuées

- Lecture complète des 24 fichiers source (engine + lab)
- Vérification de chaque critère d'acceptance du ticket
- Analyse de la sécurité : logs, CORS, erreurs exposées, accès profil
- Vérification du contrat API (Zod schema vs pipeline réel)
- Vérification de la configuration Railway
- Analyse du flux pipeline end-to-end
- Vérification de l'instruction SQL (injection, fuite d'erreur)

## Points validés

- **Séparation de service** : engine totalement hors de `apps/api`, structure monorepo propre.
- **API versionnée** : `POST /v1/query` avec Zod validation exhaustive et `GET /health`.
- **Pipeline extensible** : 3 stages comme fichiers indépendants, orchestrateur découplé, `StageResult` typé.
- **Graceful degradation** : stages absents retournent `available: false` avec raison, la requête ne plante jamais.
- **Catalog access** : `DATABASE_URL` partagée, read-only, pas de duplication de données.
- **Profile auth** : vérification d'existence dans `profiles` avant tout traitement (query.ts:31-38).
- **Logs sanitisés** : requestId, durationMs, candidateCount — aucun credential, aucune URL Xtream.
- **Railway config** : `railway.toml` complet (builder, startCommand, healthcheckPath, restart policy).
- **Local run instructions** : README clair avec variables d'environnement et commandes.
- **Lab UI** : QueryForm, ResultGrid, DiagnosticPanel, StageToggle tous présents ; stages désactivés visuellement.
- **Sécurité SQL** : postgres.js avec paramètres interpolés `${}` — pas d'injection SQL possible.
- **SIGTERM handling** : graceful shutdown implémenté (index.ts:28-32).

## Problèmes détectés

### 🔴 BLOQUANT 1 — Fuite d'erreur DB vers le client

**Fichier** : `apps/recommendation-engine/src/pipeline/stages/text-search.ts:114`

```typescript
reason: `DB error: ${err instanceof Error ? err.message : String(err)}`,
```

Ce champ `reason` est retourné dans `stageOutputs` dans la réponse HTTP au client. Un message d'erreur PostgreSQL peut exposer : noms de tables, colonnes, contraintes, détails de connexion. C'est une violation du principe de moindre exposition.

**Fix requis** :
```typescript
// Server-side
ctx.log.error({ requestId: ctx.requestId, stage: 'text-search', durationMs, err }, 'stage error')
// Client-side — générique
reason: 'Database query error',
```

---

### 🟡 MOYEN 1 — Champ `stages` accepté par l'API mais totalement ignoré

**Fichiers** : `apps/recommendation-engine/src/routes/query.ts:12-18` / `src/pipeline/pipeline.ts`

Le schéma Zod accepte `stages: { textSearch, semanticSearch, llmPlanner }` mais le pipeline ignore complètement ce champ — toutes les étapes s'exécutent toujours. Un appelant envoyant `stages: { textSearch: false }` obtient quand même des résultats text-search. Le contrat API est trompeur.

**Options** :
- Retirer le champ du schéma Zod jusqu'à implémentation (recommandé)
- OU ajouter un commentaire `/* reserved, not yet wired */` dans le schéma + documenter dans README

---

### 🟡 MOYEN 2 — Health check sans vérification DB

**Fichier** : `apps/recommendation-engine/src/routes/health.ts`

Le endpoint `/health` retourne `{ status: "ok" }` sans vérifier la connectivité base de données. Si le DB est down, Railway continue de router du trafic vers ce service qui répondra `ok` puis échouera sur `/v1/query`.

**Fix recommandé** : ajouter un `SELECT 1` probe dans le health check, ou au minimum documenter ce choix explicitement dans le README.

---

### 🔵 MINEUR — Profile ID echo dans l'erreur 404

**Fichier** : `apps/recommendation-engine/src/routes/query.ts:36`

```typescript
return reply.status(404).send({ error: `Profile ${body.profileId} not found` })
```

Echoing back l'UUID est minimal en termes de risque (le requêteur connaît déjà son UUID), mais retourner `"Profile not found"` sans echo est plus propre et cohérent avec la gestion d'erreur du reste du service.

---

### 🔵 MINEUR — `durationMs` mesuré deux fois dans text-search

**Fichier** : `apps/recommendation-engine/src/pipeline/stages/text-search.ts:96-101`

Le log à la ligne 96 et le `return` à la ligne 101 capturent tous les deux `Date.now() - start` séparément. La valeur retournée sera légèrement supérieure à la valeur loguée. Capturer une fois : `const durationMs = Date.now() - start`.

---

### 🔵 MINEUR — `to_tsvector` calculé à la volée (pas d'index GIN)

**Fichier** : `apps/recommendation-engine/src/pipeline/stages/text-search.ts:22-29`

La recherche full-text recalcule `to_tsvector(title || synopsis)` à chaque requête sans index GIN. Acceptable pour un lab, mais à documenter comme dette technique avant mise en production avec un catalog volumineux.

## Risques éventuels

- **CORS_ORIGIN = `*` par défaut** : en production Railway sans configuration explicite, toute origine est autorisée. Le README en parle, `railway.toml` le commente, mais rien ne l'applique de force. Risque modéré pour un service d'admin.
- **Aucune authentification sur `/v1/query`** : profil vérifié pour existence mais pas pour appartenance à l'utilisateur courant. Quiconque a accès réseau peut itérer sur des UUIDs de profils. Acceptable pour du tooling admin isolé, mais à documenter.
- **URL TMDB hardcodée** : `https://image.tmdb.org/t/p/w300` dans ResultGrid.tsx — couplage implicite à TMDB, correct pour l'état actuel du catalog.

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES** — 1 problème de sécurité bloquant (fuite erreur DB), 1 contrat API trompeur à corriger.

## Actions demandées

1. **[BLOQUANT]** `text-search.ts:114` — Remplacer le message d'erreur DB exposé au client par une chaîne générique `'Database query error'`. Garder l'erreur complète uniquement dans les logs serveur.

2. **[MOYEN]** `query.ts:12-18` — Supprimer le champ `stages` du schéma Zod (ou le marquer `/* reserved */` + documenter dans README comme non-opérationnel) pour éviter un contrat API trompeur.

3. **[RECOMMANDÉ]** `health.ts` — Ajouter une vérification DB basique (`SELECT 1`) ou documenter explicitement que le health check est intentionnellement superficiel (acceptable si Railway est configuré avec un check dédié).

4. **[MINEUR]** `query.ts:36` — Généraliser le message 404 en `"Profile not found"` sans echo de l'UUID.

5. **[MINEUR]** `text-search.ts:96-101` — Capturer `durationMs` une seule fois avant le log et le return.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T101/reviews/implementation-review.md
- generated at: 2026-08-18T13:10:20Z

---

I have all the information I need. Here is the structured review:

---

# PR Review — T101 · Standalone Recommendation Engine + Lab UI

## Résumé

L'implémentation ajoute deux applications au monorepo : `apps/recommendation-engine` (Fastify/TypeScript, port 3001) et `apps/recommendation-lab` (React/Vite, port 3002). Le service expose `GET /health` et `POST /v1/query` avec pipeline en 3 étapes (text-search disponible, semantic-search et llm-planner en stub). Le Lab UI permet la saisie de requêtes, l'affichage des résultats et un panneau diagnostique. La structure est propre et l'architecture respecte le périmètre du ticket.

## Vérifications effectuées

- Lecture complète des 24 fichiers source (engine + lab)
- Vérification de chaque critère d'acceptance du ticket
- Analyse de la sécurité : logs, CORS, erreurs exposées, accès profil
- Vérification du contrat API (Zod schema vs pipeline réel)
- Vérification de la configuration Railway
- Analyse du flux pipeline end-to-end
- Vérification de l'instruction SQL (injection, fuite d'erreur)

## Points validés

- **Séparation de service** : engine totalement hors de `apps/api`, structure monorepo propre.
- **API versionnée** : `POST /v1/query` avec Zod validation exhaustive et `GET /health`.
- **Pipeline extensible** : 3 stages comme fichiers indépendants, orchestrateur découplé, `StageResult` typé.
- **Graceful degradation** : stages absents retournent `available: false` avec raison, la requête ne plante jamais.
- **Catalog access** : `DATABASE_URL` partagée, read-only, pas de duplication de données.
- **Profile auth** : vérification d'existence dans `profiles` avant tout traitement (query.ts:31-38).
- **Logs sanitisés** : requestId, durationMs, candidateCount — aucun credential, aucune URL Xtream.
- **Railway config** : `railway.toml` complet (builder, startCommand, healthcheckPath, restart policy).
- **Local run instructions** : README clair avec variables d'environnement et commandes.
- **Lab UI** : QueryForm, ResultGrid, DiagnosticPanel, StageToggle tous présents ; stages désactivés visuellement.
- **Sécurité SQL** : postgres.js avec paramètres interpolés `${}` — pas d'injection SQL possible.
- **SIGTERM handling** : graceful shutdown implémenté (index.ts:28-32).

## Problèmes détectés

### 🔴 BLOQUANT 1 — Fuite d'erreur DB vers le client

**Fichier** : `apps/recommendation-engine/src/pipeline/stages/text-search.ts:114`

```typescript
reason: `DB error: ${err instanceof Error ? err.message : String(err)}`,
```

Ce champ `reason` est retourné dans `stageOutputs` dans la réponse HTTP au client. Un message d'erreur PostgreSQL peut exposer : noms de tables, colonnes, contraintes, détails de connexion. C'est une violation du principe de moindre exposition.

**Fix requis** :
```typescript
// Server-side
ctx.log.error({ requestId: ctx.requestId, stage: 'text-search', durationMs, err }, 'stage error')
// Client-side — générique
reason: 'Database query error',
```

---

### 🟡 MOYEN 1 — Champ `stages` accepté par l'API mais totalement ignoré

**Fichiers** : `apps/recommendation-engine/src/routes/query.ts:12-18` / `src/pipeline/pipeline.ts`

Le schéma Zod accepte `stages: { textSearch, semanticSearch, llmPlanner }` mais le pipeline ignore complètement ce champ — toutes les étapes s'exécutent toujours. Un appelant envoyant `stages: { textSearch: false }` obtient quand même des résultats text-search. Le contrat API est trompeur.

**Options** :
- Retirer le champ du schéma Zod jusqu'à implémentation (recommandé)
- OU ajouter un commentaire `/* reserved, not yet wired */` dans le schéma + documenter dans README

---

### 🟡 MOYEN 2 — Health check sans vérification DB

**Fichier** : `apps/recommendation-engine/src/routes/health.ts`

Le endpoint `/health` retourne `{ status: "ok" }` sans vérifier la connectivité base de données. Si le DB est down, Railway continue de router du trafic vers ce service qui répondra `ok` puis échouera sur `/v1/query`.

**Fix recommandé** : ajouter un `SELECT 1` probe dans le health check, ou au minimum documenter ce choix explicitement dans le README.

---

### 🔵 MINEUR — Profile ID echo dans l'erreur 404

**Fichier** : `apps/recommendation-engine/src/routes/query.ts:36`

```typescript
return reply.status(404).send({ error: `Profile ${body.profileId} not found` })
```

Echoing back l'UUID est minimal en termes de risque (le requêteur connaît déjà son UUID), mais retourner `"Profile not found"` sans echo est plus propre et cohérent avec la gestion d'erreur du reste du service.

---

### 🔵 MINEUR — `durationMs` mesuré deux fois dans text-search

**Fichier** : `apps/recommendation-engine/src/pipeline/stages/text-search.ts:96-101`

Le log à la ligne 96 et le `return` à la ligne 101 capturent tous les deux `Date.now() - start` séparément. La valeur retournée sera légèrement supérieure à la valeur loguée. Capturer une fois : `const durationMs = Date.now() - start`.

---

### 🔵 MINEUR — `to_tsvector` calculé à la volée (pas d'index GIN)

**Fichier** : `apps/recommendation-engine/src/pipeline/stages/text-search.ts:22-29`

La recherche full-text recalcule `to_tsvector(title || synopsis)` à chaque requête sans index GIN. Acceptable pour un lab, mais à documenter comme dette technique avant mise en production avec un catalog volumineux.

## Risques éventuels

- **CORS_ORIGIN = `*` par défaut** : en production Railway sans configuration explicite, toute origine est autorisée. Le README en parle, `railway.toml` le commente, mais rien ne l'applique de force. Risque modéré pour un service d'admin.
- **Aucune authentification sur `/v1/query`** : profil vérifié pour existence mais pas pour appartenance à l'utilisateur courant. Quiconque a accès réseau peut itérer sur des UUIDs de profils. Acceptable pour du tooling admin isolé, mais à documenter.
- **URL TMDB hardcodée** : `https://image.tmdb.org/t/p/w300` dans ResultGrid.tsx — couplage implicite à TMDB, correct pour l'état actuel du catalog.

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES** — 1 problème de sécurité bloquant (fuite erreur DB), 1 contrat API trompeur à corriger.

## Actions demandées

1. **[BLOQUANT]** `text-search.ts:114` — Remplacer le message d'erreur DB exposé au client par une chaîne générique `'Database query error'`. Garder l'erreur complète uniquement dans les logs serveur.

2. **[MOYEN]** `query.ts:12-18` — Supprimer le champ `stages` du schéma Zod (ou le marquer `/* reserved */` + documenter dans README comme non-opérationnel) pour éviter un contrat API trompeur.

3. **[RECOMMANDÉ]** `health.ts` — Ajouter une vérification DB basique (`SELECT 1`) ou documenter explicitement que le health check est intentionnellement superficiel (acceptable si Railway est configuré avec un check dédié).

4. **[MINEUR]** `query.ts:36` — Généraliser le message 404 en `"Profile not found"` sans echo de l'UUID.

5. **[MINEUR]** `text-search.ts:96-101` — Capturer `durationMs` une seule fois avant le log et le return.

---

IMPLEMENTATION_FIX_REQUIRED