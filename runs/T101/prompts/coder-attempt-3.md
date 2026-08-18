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

All fixes are clean. Here's a summary of what was changed:

**Files modified:**

| File | Fix |
|---|---|
| `src/pipeline/stages/text-search.ts` | **[BLOQUANT]** DB error message in catch block replaced with generic `'Database query error'` — full error still logged server-side. **[MINEUR]** `durationMs` captured once before log + return. |
| `src/routes/query.ts` | **[MOYEN]** `stages` field removed from Zod schema (was accepted but fully ignored). **[MINEUR]** Profile 404 message no longer echoes the UUID. |
| `src/routes/health.ts` | **[RECOMMANDÉ]** Added `SELECT 1` DB probe — returns HTTP 503 if DB is unreachable. |
| `README.md` | Health check and stages field documented accurately. |

---

## Review

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T101 · Standalone Recommendation Engine + Lab UI (Retry 2)

## Résumé

Cette review porte sur la deuxième soumission après le premier `IMPLEMENTATION_FIX_REQUIRED`. Les 5 corrections demandées (fuite erreur DB, champ `stages` trompeur dans Zod, health check sans probe DB, echo UUID 404, double mesure `durationMs`) ont toutes été appliquées correctement. L'architecture est solide, le périmètre respecté, et la qualité globale du code est bonne. Un problème de sécurité nouveau est identifié (`.env` tracké dans git) qui requiert une correction avant merge.

## Vérifications effectuées

- Relecture des 24 fichiers source (engine + lab)
- Vérification point par point des 5 corrections demandées dans la review précédente
- Vérification des fichiers trackés dans git (`git ls-files`)
- Vérification des imports/usages croisés (`schema.ts`, `db`, `stages`)
- Analyse du commit `a8e8f15f` (auto-commit daemon)
- Vérification des critères d'acceptance du ticket

## Points validés

**Corrections de la review précédente — toutes appliquées :**

- **[BLOQUANT résolu]** `text-search.ts:115` — erreur DB remplacée par `'Database query error'` générique, erreur complète uniquement dans les logs serveur.
- **[MOYEN résolu]** `query.ts` — champ `stages` supprimé du schéma Zod. Le contrat API est maintenant honnête.
- **[RECOMMANDÉ résolu]** `health.ts:8-9` — probe `SELECT 1` ajouté, retourne HTTP 503 si DB inaccessible. Correct pour Railway.
- **[MINEUR résolu]** `query.ts:29` — 404 retourne `"Profile not found"` sans echo de l'UUID.
- **[MINEUR résolu]** `text-search.ts:95-107` — `durationMs` capturé une seule fois avant log et return.

**Architecture et fonctionnalités :**

- Service standalone hors `apps/api`, structure monorepo propre.
- `GET /health` avec probe DB, `POST /v1/query` avec validation Zod exhaustive.
- Pipeline en 3 stages indépendants ; graceful degradation pour les stubs.
- `SIGTERM` / shutdown graceful implémenté.
- Logs Pino structurés : `requestId`, `durationMs`, `candidateCount`, `finalCount` — aucun credential.
- Lab UI complet : QueryForm, ResultGrid, DiagnosticPanel, StageToggle — stages désactivés visuellement avec tooltip.
- `railway.toml` complet et fonctionnel.
- `.env.example` présent et cohérent avec le README.
- CORS configurable via `CORS_ORIGIN`, default `*` documenté.

## Problèmes détectés

### 🔴 BLOQUANT — `.env` tracké dans git

**Commit** : `a8e8f15f` (chore(T101): pre-sync auto-commit)

```
apps/recommendation-engine/.env  ← tracké dans git
```

Contenu commité :
```
DATABASE_URL=postgresql://iptvflix:iptvflix@localhost:5433/iptvflix
PORT=3001
LOG_LEVEL=info
CORS_ORIGIN=*
```

Ce fichier a été commité par le daemon de pre-sync, pas par le développeur — mais le résultat est identique : un `.env` avec credentials est dans l'historique git. Le `.gitignore` à la racine liste bien `.env` mais le fichier a été ajouté avant d'être ignoré (ou hors du scope du .gitignore à ce moment).

Ce fichier **ne doit pas** être dans le PR. Même avec des credentials de développement local, commettre un `.env` dans un PR est une violation de la règle security (ne pas exposer des secrets) et crée un précédent dangereux : si quelqu'un met à jour ce fichier avec des credentials de production, ils seront dans l'historique.

**Fix requis** :
```bash
git rm --cached apps/recommendation-engine/.env
# Vérifier que .gitignore couvre bien ce chemin
# Committer le résultat
```

---

### 🔵 MINEUR — `schema.ts` jamais importé, `db` (Drizzle) jamais utilisé

**Fichier** : `apps/recommendation-engine/src/db/client.ts:6` et `src/db/schema.ts`

```typescript
export const db = drizzle(pgClient)  // jamais importé
```

`schema.ts` définit les tables Drizzle (movies, series, genres, profiles, mediaEmbeddings) mais n'est importé nulle part dans le projet. `db` (l'instance Drizzle) est exporté mais jamais consommé — toutes les queries utilisent directement `pgClient`. Ces deux exports sont du code mort.

C'est acceptable comme skeleton pour les prochains tickets si l'intention est de migrer vers Drizzle query builder. Si ce n'est pas l'intention de T101, les supprimer simplifie le code.

**Observation seulement** — non bloquant.

---

### 🔵 MINEUR — `stages` toujours présent dans le type `QueryRequest`

**Fichier** : `apps/recommendation-engine/src/pipeline/types.ts:10-15`

```typescript
export interface QueryRequest {
  // ...
  stages?: {
    textSearch?: boolean
    semanticSearch?: boolean
    llmPlanner?: boolean
  }
}
```

Le champ `stages` a été retiré du schéma Zod (correct) mais reste dans le type TypeScript. Comme Zod strip les champs inconnus par défaut, `stages` n'atteindra jamais la pipeline. L'interface TypeScript est donc en avance sur l'API réelle — confus pour le prochain développeur.

**Observation seulement** — non bloquant.

## Risques éventuels

- **Aucune auth sur `/v1/query`** : le `profileId` vérifie l'existence mais pas l'appartenance à un utilisateur authentifié. Acceptable pour du tooling admin en réseau fermé, mais à documenter comme contrainte avant exposition externe. La pipeline ne retourne pas encore de données de goût, donc le risque pratique est limité.
- **Full-text sans index GIN** : `to_tsvector` calculé à la volée sur chaque requête — déjà noté dans la review précédente comme dette technique acceptable pour un lab.
- **12 entrées `node_modules` trackées** : également introduites par le même auto-commit daemon. À nettoyer en même temps que le `.env`.

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES** — 1 problème de sécurité bloquant (`.env` tracké dans git)

## Actions demandées

1. **[BLOQUANT]** Retirer `apps/recommendation-engine/.env` du tracking git avec `git rm --cached apps/recommendation-engine/.env`. S'assurer que `.gitignore` couvre ce chemin. Committer le résultat. Vérifier aussi les 12 entrées `node_modules` trackées dans le même commit.

2. **[OPTIONNEL]** Supprimer le champ `stages` de `QueryRequest` dans `types.ts` pour que le type reflète fidèlement le contrat API actuel.

3. **[OPTIONNEL]** Supprimer `export const db = drizzle(pgClient)` de `client.ts` (et `schema.ts`) si ces exports ne sont pas utilisés intentionnellement comme scaffold pour T102+.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T101/reviews/implementation-review.md
- generated at: 2026-08-18T13:19:56Z

---

I now have a complete picture of the implementation. Let me write the review.

---

# PR Review — T101 · Standalone Recommendation Engine + Lab UI (Retry 2)

## Résumé

Cette review porte sur la deuxième soumission après le premier `IMPLEMENTATION_FIX_REQUIRED`. Les 5 corrections demandées (fuite erreur DB, champ `stages` trompeur dans Zod, health check sans probe DB, echo UUID 404, double mesure `durationMs`) ont toutes été appliquées correctement. L'architecture est solide, le périmètre respecté, et la qualité globale du code est bonne. Un problème de sécurité nouveau est identifié (`.env` tracké dans git) qui requiert une correction avant merge.

## Vérifications effectuées

- Relecture des 24 fichiers source (engine + lab)
- Vérification point par point des 5 corrections demandées dans la review précédente
- Vérification des fichiers trackés dans git (`git ls-files`)
- Vérification des imports/usages croisés (`schema.ts`, `db`, `stages`)
- Analyse du commit `a8e8f15f` (auto-commit daemon)
- Vérification des critères d'acceptance du ticket

## Points validés

**Corrections de la review précédente — toutes appliquées :**

- **[BLOQUANT résolu]** `text-search.ts:115` — erreur DB remplacée par `'Database query error'` générique, erreur complète uniquement dans les logs serveur.
- **[MOYEN résolu]** `query.ts` — champ `stages` supprimé du schéma Zod. Le contrat API est maintenant honnête.
- **[RECOMMANDÉ résolu]** `health.ts:8-9` — probe `SELECT 1` ajouté, retourne HTTP 503 si DB inaccessible. Correct pour Railway.
- **[MINEUR résolu]** `query.ts:29` — 404 retourne `"Profile not found"` sans echo de l'UUID.
- **[MINEUR résolu]** `text-search.ts:95-107` — `durationMs` capturé une seule fois avant log et return.

**Architecture et fonctionnalités :**

- Service standalone hors `apps/api`, structure monorepo propre.
- `GET /health` avec probe DB, `POST /v1/query` avec validation Zod exhaustive.
- Pipeline en 3 stages indépendants ; graceful degradation pour les stubs.
- `SIGTERM` / shutdown graceful implémenté.
- Logs Pino structurés : `requestId`, `durationMs`, `candidateCount`, `finalCount` — aucun credential.
- Lab UI complet : QueryForm, ResultGrid, DiagnosticPanel, StageToggle — stages désactivés visuellement avec tooltip.
- `railway.toml` complet et fonctionnel.
- `.env.example` présent et cohérent avec le README.
- CORS configurable via `CORS_ORIGIN`, default `*` documenté.

## Problèmes détectés

### 🔴 BLOQUANT — `.env` tracké dans git

**Commit** : `a8e8f15f` (chore(T101): pre-sync auto-commit)

```
apps/recommendation-engine/.env  ← tracké dans git
```

Contenu commité :
```
DATABASE_URL=postgresql://iptvflix:iptvflix@localhost:5433/iptvflix
PORT=3001
LOG_LEVEL=info
CORS_ORIGIN=*
```

Ce fichier a été commité par le daemon de pre-sync, pas par le développeur — mais le résultat est identique : un `.env` avec credentials est dans l'historique git. Le `.gitignore` à la racine liste bien `.env` mais le fichier a été ajouté avant d'être ignoré (ou hors du scope du .gitignore à ce moment).

Ce fichier **ne doit pas** être dans le PR. Même avec des credentials de développement local, commettre un `.env` dans un PR est une violation de la règle security (ne pas exposer des secrets) et crée un précédent dangereux : si quelqu'un met à jour ce fichier avec des credentials de production, ils seront dans l'historique.

**Fix requis** :
```bash
git rm --cached apps/recommendation-engine/.env
# Vérifier que .gitignore couvre bien ce chemin
# Committer le résultat
```

---

### 🔵 MINEUR — `schema.ts` jamais importé, `db` (Drizzle) jamais utilisé

**Fichier** : `apps/recommendation-engine/src/db/client.ts:6` et `src/db/schema.ts`

```typescript
export const db = drizzle(pgClient)  // jamais importé
```

`schema.ts` définit les tables Drizzle (movies, series, genres, profiles, mediaEmbeddings) mais n'est importé nulle part dans le projet. `db` (l'instance Drizzle) est exporté mais jamais consommé — toutes les queries utilisent directement `pgClient`. Ces deux exports sont du code mort.

C'est acceptable comme skeleton pour les prochains tickets si l'intention est de migrer vers Drizzle query builder. Si ce n'est pas l'intention de T101, les supprimer simplifie le code.

**Observation seulement** — non bloquant.

---

### 🔵 MINEUR — `stages` toujours présent dans le type `QueryRequest`

**Fichier** : `apps/recommendation-engine/src/pipeline/types.ts:10-15`

```typescript
export interface QueryRequest {
  // ...
  stages?: {
    textSearch?: boolean
    semanticSearch?: boolean
    llmPlanner?: boolean
  }
}
```

Le champ `stages` a été retiré du schéma Zod (correct) mais reste dans le type TypeScript. Comme Zod strip les champs inconnus par défaut, `stages` n'atteindra jamais la pipeline. L'interface TypeScript est donc en avance sur l'API réelle — confus pour le prochain développeur.

**Observation seulement** — non bloquant.

## Risques éventuels

- **Aucune auth sur `/v1/query`** : le `profileId` vérifie l'existence mais pas l'appartenance à un utilisateur authentifié. Acceptable pour du tooling admin en réseau fermé, mais à documenter comme contrainte avant exposition externe. La pipeline ne retourne pas encore de données de goût, donc le risque pratique est limité.
- **Full-text sans index GIN** : `to_tsvector` calculé à la volée sur chaque requête — déjà noté dans la review précédente comme dette technique acceptable pour un lab.
- **12 entrées `node_modules` trackées** : également introduites par le même auto-commit daemon. À nettoyer en même temps que le `.env`.

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES** — 1 problème de sécurité bloquant (`.env` tracké dans git)

## Actions demandées

1. **[BLOQUANT]** Retirer `apps/recommendation-engine/.env` du tracking git avec `git rm --cached apps/recommendation-engine/.env`. S'assurer que `.gitignore` couvre ce chemin. Committer le résultat. Vérifier aussi les 12 entrées `node_modules` trackées dans le même commit.

2. **[OPTIONNEL]** Supprimer le champ `stages` de `QueryRequest` dans `types.ts` pour que le type reflète fidèlement le contrat API actuel.

3. **[OPTIONNEL]** Supprimer `export const db = drizzle(pgClient)` de `client.ts` (et `schema.ts`) si ces exports ne sont pas utilisés intentionnellement comme scaffold pour T102+.

---

IMPLEMENTATION_FIX_REQUIRED