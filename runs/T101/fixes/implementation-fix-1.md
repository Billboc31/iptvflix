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
