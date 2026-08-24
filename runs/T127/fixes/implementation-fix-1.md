# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T127/reviews/implementation-review.md
- generated at: 2026-08-24T09:30:35Z

---

# PR Review — T127: Build a true must-watch Hero ranker for Home

## Résumé

L'implémentation du hero ranker (`hero-selector.ts`) est correcte, complète, et conforme au plan. Cependant, le coder a profité de ce ticket pour opérer une réécriture architecturale massive de la couche Home (pool, service, snapshot, frontend, contrats API) qui était **explicitement exclue** du scope T127. Cela génère un risque de régression non contrôlé sur des comportements validés par T126.

---

## Vérifications effectuées

- Lecture complète de `hero-selector.ts` (nouveau fichier)
- Lecture complète de `hero-selector.test.ts` (469 lignes)
- `git diff main --stat` sur tous les fichiers touchés
- Lecture du diff de `home-pool-service.ts` (+416 lignes), `home-service.ts` (+295 lignes), `recommendation-engine-client.ts`, `env.ts`

---

## Points validés

**hero-selector.ts (dans scope)**
- Pool cap via `candidates.slice(0, HERO_POOL_SIZE)` : correct
- Gate d'éligibilité `available && finalScore >= HERO_MIN_SCORE` : préservée
- Filtre dislike via DB `explicitFeedback` : correct
- Enrichissement DB par batch (`Promise.all` movies/series/trailers) : correct
- `computeHeroScore()` — fonction pure exportée, formule pondérée à 4 composantes : conforme au plan
- Sélection par `ranked.sort((a, b) => b.heroScore - a.heroScore)` et `ranked[0]` : élimine le "premier éligible"
- Log `[HERO_RANKING]` avec pool/eligible/winner/heroScore/weights : conforme
- `return null` si aucun candidat éligible après enrichissement : correct

**recommendation-engine-client.ts (dans scope)**
- Ajout de `qualityPrior: number` et `languageAffinity: number` à `ShelfCandidateItem` : conforme
- Mapping depuis `r.scoreBreakdown?.qualityPrior ?? 0` et `r.scoreBreakdown?.languageAffinity ?? 0` : correct

**env.ts (dans scope)**
- `HERO_POOL_SIZE` (env, défaut 15) : conforme au plan
- `HERO_SCORE_WEIGHTS` (objet versionné `v1`, 4 poids) : conforme

**Tests (9/9 cas couverts)**
- Test 1 : le candidat #3 avec `profileScore=0.9` bat les candidats #1 et #2 ✓
- Test 2 : le candidat à l'index 7/10 avec `profileScore=0.95` gagne ✓
- Test 3 : `qualityPrior=0.95` compense une légère faiblesse de `profileScore` ✓
- Test 4 : disliked ne peut pas gagner même avec le meilleur `heroScore` potentiel ✓
- Test 5 : `available=false` exclu avant ranking ✓
- Test 6 : `backdropPath=null` exclu ✓
- Test 7 : contenu à haute `languageAffinity` (0.95) gagne sans hard-filter langue ✓
- Test 8 : `null` retourné si tous les candidats n'ont pas de backdrop ✓
- Test 9 : `computeHeroScore` vérifié avec inputs connus, résultat 0.705 ✓

---

## Problèmes détectés

### [BLOQUANT] Violation de scope massive — 6 fichiers explicitement exclus modifiés

Le plan T127 section "Excluded" stipule explicitement :
> - Changes to the `home-pool-service.ts` rail assembly, pool filling…
> - Changes to `home-service.ts`, `home-snapshot-service.ts`, or snapshot schema/migrations
> - Frontend/web changes (`HomePage.tsx`, `useHome.ts`)
> - Exposing `heroScore` in the consumer Home API response (`HomePageResponse`, `HeroItem`)

L'implémentation a modifié :

| Fichier | Lignes ∆ | Statut plan |
|---|---|---|
| `home-pool-service.ts` | +416 | **Exclu** — seul `qualityPrior: 0, languageAffinity: 0` prévu |
| `home-service.ts` | +295 | **Exclu** |
| `home-snapshot-service.ts` | +62 | **Exclu** |
| `apps/web/src/pages/HomePage.tsx` | +51 | **Exclu** |
| `apps/web/src/hooks/useHome.ts` | +8 | **Exclu** |
| `packages/api-contracts/src/home.ts` | +11 | **Exclu** |

**Impact :**
- `persistFixedShelvesForSession()` a été supprimée et remplacée par `buildDeclaredRails()` — changement architectural majeur non planifié
- `home-service.ts` a été réécrit pour utiliser la nouvelle architecture de snapshot (`reconstructShelvesFromSnapshot`, `reconstructHero`) — la stabilité du snapshot T126 peut avoir régressé silencieusement
- Des contrats API ont été étendus sans plan
- Le frontend a été modifié sans plan ni tests UI

### [BLOQUANT] `recommendation-engine-client.ts` — changements hors scope

Au-delà de l'ajout de `qualityPrior`/`languageAffinity` (planifié), le coder a ajouté :
- `freshnessBoostDays?: number` à la méthode `query()`
- `mediaTypeFilter?: 'MOVIE' | 'SERIES'` et `freshnessBoostDays?: number` à `queryForShelf()`

Ces paramètres ne sont ni dans le plan T127, ni justifiés par le hero ranker — ils existent uniquement pour supporter le `buildDeclaredRails()` hors scope.

### [BLOQUANT] `env.ts` — constantes parasites

`HOME_FRESH_DAYS` et `HOME_SNAPSHOT_TTL_HOURS` ont été ajoutés uniquement pour la réécriture hors scope de `home-pool-service.ts`. À supprimer si cette réécriture est revertée.

### [Mineur] Log structuré potentiellement illisible

```typescript
console.info(`[HERO_RANKING] ...`, { candidates: ranked.map(...) })
```

Le second argument `Object` sera affiché comme `[Object]` dans des loggers non-structurés (ex: PM2 sans pino). Pas bloquant mais à surveiller en production.

---

## Risques éventuels

- **Régression T126** : La réécriture de `home-service.ts` et `home-snapshot-service.ts` modifie le comportement de cache ~24h introduit par T126 sans tests de non-régression spécifiques à ces changements.
- **API contract cassé** : Les changements dans `packages/api-contracts/src/home.ts` peuvent affecter les clients du contrat (web app, éventuellement d'autres consommateurs).
- **Test de snapshot T127** manquant : Le ticket exige un test #7 "Snapshot persistence still keeps the selected hero stable across Home refreshes" — ce test n'est pas présent dans `hero-selector.test.ts`. Il devrait être dans `home-snapshot.test.ts` mais aucune modification du snapshot test n'est incluse dans le scope T127.

---

## Décision

**IMPLEMENTATION_FIX_REQUIRED**

## Actions demandées

1. **Revenir** à l'état de `main` pour les 6 fichiers hors scope : `home-pool-service.ts`, `home-service.ts`, `home-snapshot-service.ts`, `HomePage.tsx`, `useHome.ts`, `packages/api-contracts/src/home.ts`.

2. **Dans `home-pool-service.ts`**, appliquer uniquement la correction prévue au plan : ajouter `qualityPrior: 0, languageAffinity: 0` au mapper du fallback catalog (les candidats du `rankRecommendations` qui ne passent pas par le moteur).

3. **Dans `recommendation-engine-client.ts`**, retirer `freshnessBoostDays` et `mediaTypeFilter` de `queryForShelf()` et de `query()` — garder uniquement `qualityPrior`/`languageAffinity`.

4. **Dans `env.ts`**, retirer `HOME_FRESH_DAYS` et `HOME_SNAPSHOT_TTL_HOURS` (uniquement nécessaires pour les changements hors scope). Garder `HERO_POOL_SIZE`, `HERO_SCORE_WEIGHTS`, `HERO_MIN_SCORE`.

5. **Ajouter le test de stabilité snapshot** exigé par le ticket (test #7 : le hero sélectionné reste stable à travers les refreshes Home — peut être un test d'intégration léger sur le comportement snapshot existant).

6. Les 4 fichiers du core T127 (`hero-selector.ts`, `hero-selector.test.ts`, `env.ts` (purgé), `recommendation-engine-client.ts` (purgé)) peuvent être conservés tels quels — ils sont corrects.

IMPLEMENTATION_FIX_REQUIRED
