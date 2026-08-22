# T116 — Unifier tous les parcours de recommandation sur le pipeline sémantique + SCORE_MODEL_V2

**Source**: GitHub Issue #248

## Description

## Constat

Aujourd’hui plusieurs parcours de recommandation utilisent des moteurs différents, ce qui rend la qualité incohérente et le Lab trompeur :

- `/v1/query` : LLM planner → text search → semantic search → merge → `SCORE_MODEL_V2` → diversité ✅
- `/v1/personalized` : top 200 par popularité/note → `runHybridReranker` ; pas de retrieval sémantique ⚠️
- génération de shelf depuis des seeds : ranking local surtout basé sur affinité de genres ; pas de pipeline sémantique/V2 ❌
- preview des `ShelfConcept` dans le Lab : `semanticQuery({ query: concept.semanticIntent, topK: 5 })` ; top 5 vector brut, sans profile rerank ni pipeline complet ❌

Conséquence observée : certains concepts corrects produisent en preview des résultats lexicalement proches mais éditorialement faibles (`Aventures à travers le temps` → titres contenant aventure/voyage, `Épopées modernes` → documentaires/films hors intention), alors que le pipeline complet est capable de remonter des candidats beaucoup plus cohérents.

## Objectif

Avoir **un moteur central unique** pour toutes les recommandations finales. Les différents usages peuvent construire l’intention ou les seeds différemment, mais doivent converger vers le même chemin de retrieval + scoring + filtres + diversité.

## Architecture cible

```text
source d’intention
  ├─ requête utilisateur
  ├─ ShelfConcept personnalisé
  ├─ profil seul / Home
  └─ 3–10 media seeds
        ↓
RecommendationQueryPlan / intention explicite
        ↓
retrieval candidats
  ├─ semantic pgvector
  └─ text/fallback si nécessaire
        ↓
pool cible ~200 candidats
        ↓
SCORE_MODEL_V2
  - semantic
  - genre/theme
  - people
  - keywords
  - franchise
  - language/country
  - decade
  - media type
  - freshness / quality / availability
  - watched / abandon / dislike / not interested
  - exposure/repetition
        ↓
diversité
        ↓
résultats finaux
```

## Travaux

### 1. Extraire un service de recommandation réutilisable
- [ ] Extraire le coeur de `runPipeline` pour qu’un appel interne puisse fournir un `RecommendationQueryPlan` déjà construit sans forcément refaire le planner.
- [ ] Permettre de fournir `profileId`, `mediaTypes`, `limit`, `debug` et éventuellement `candidatePoolSize`.
- [ ] Garder le fallback texte quand le vector search est indisponible.
- [ ] Retourner les mêmes métadonnées/debug pour tous les parcours : query plan, candidate count, score breakdown, versions des modèles, timings et fallbacks.

### 2. Corriger la preview des ShelfConcepts
- [ ] Ne plus afficher uniquement `semanticQuery(topK: 5)` comme si c’était le résultat final.
- [ ] Ajouter une preview **Final / personnalisé** qui utilise le `profileId` sélectionné + le pipeline central + le `ShelfConcept`.
- [ ] Conserver en parallèle une vue **Raw vector** pour diagnostiquer les embeddings.
- [ ] Afficher : candidats vectoriels, résultat reranké, score final et score breakdown.
- [ ] Le concept doit utiliser son `semanticIntent`, ses media types, freshness policy, hard filters/contraintes pertinentes.

### 3. Corriger `/v1/personalized`
- [ ] Ne plus limiter le candidate pool aux 200 contenus globalement les plus populaires.
- [ ] Construire un plan de recommandation profil-only adapté : goûts dominants + exploration + signaux récents + éventuels concepts de shelf.
- [ ] Utiliser retrieval sémantique + V2.
- [ ] Vérifier le mode cold-start : popularité/qualité reste un fallback/prior, pas la source unique des candidats.
- [ ] Corriger la metadata qui annonce actuellement `SCORE_MODEL_V1` alors que `runHybridReranker` exécute V2.

### 4. Corriger la génération de shelf depuis des seeds
- [ ] Remplacer le ranking maison purement genre par une intention dérivée des 3–10 seeds.
- [ ] Construire le profil sémantique des seeds à partir de leurs métadonnées/embeddings (genres, thèmes, keywords, people, franchise, langue, époque, etc.).
- [ ] Faire le retrieval sur ce profil, exclure les seeds, puis passer les candidats dans `SCORE_MODEL_V2` avec le profil utilisateur.
- [ ] Conserver `availableToMe`, `mediaType` et les exclusions existantes.

### 5. Candidate pool / qualité
- [ ] Utiliser un pool assez large avant reranking (cible initiale : ~200, configurable).
- [ ] Ne jamais considérer le top vector brut comme shelf finale.
- [ ] Ajouter un test garantissant qu’un candidat sémantiquement pertinent peut remonter après V2 même s’il n’est pas top 5 vector.
- [ ] Ajouter des tests sur des intentions ambiguës : `Aventures à travers le temps`, `Épopées modernes`, `film qui retourne le cerveau`.

### 6. Cohérence scoring / diversité
- [ ] Toutes les recommandations finales doivent utiliser `SCORE_MODEL_V2` (ou version ultérieure unique).
- [ ] Appliquer les mêmes hard filters et pénalités partout.
- [ ] Appliquer la diversité finale partout (collection/director + future diversification inter-shelves).
- [ ] Uniformiser `engineMetadata.rerankerVersion`.

## Acceptance criteria

- La preview d’un ShelfConcept propose deux modes clairement nommés : `Raw vector` et `Final personnalisé`.
- `Final personnalisé` passe par le même scorer que les recommandations de production.
- `/v1/personalized` n’utilise plus uniquement les top contenus par popularité comme candidate pool.
- Une shelf générée depuis des seeds utilise embeddings/retrieval + profil + V2.
- Les mêmes entrées donnent un score/ranking cohérent quel que soit le point d’entrée.
- Les debug outputs montrent clairement : intention utilisée → candidate pool → score V2 → filtres → résultat final.
- Aucun endpoint n’annonce V1 s’il exécute V2.

## Hors scope / suite

Une fois ce ticket terminé et la qualité validée dans le Lab, définir précisément :
1. les shelves affichées sur Home,
2. les recommandations contextuelles sur fiche Film/Série,
3. la stratégie de calcul, cache, invalidation et régénération des recommandations.
