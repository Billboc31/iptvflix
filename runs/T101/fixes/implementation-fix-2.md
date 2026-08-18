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
