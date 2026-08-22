---

## Review — T116 : Unifier les parcours de recommandation

### Résumé exécutif

L'implémentation est **fondamentalement correcte et complète**. Les quatre parcours de recommandation convergent bien sur un service central unique. Deux gaps mineurs sont identifiés, non bloquants pour le comportement core.

---

### 1. Conformité au ticket

#### Architecture cible atteinte

| Parcours | Avant | Après |
|---|---|---|
| `/v1/query` | LLM → pipeline (déjà V2) | LLM → `runRecommendationFromPlan` (inchangé, validé) |
| `/v1/personalized` | top-200 popularité → `runHybridReranker` | `buildProfileQueryPlan` → `runRecommendationFromPlan` + V2 ✅ |
| Shelf seeds | ranking genre maison | `buildSeedQueryPlan` → `runRecommendationFromPlan` + V2 ✅ |
| Preview ShelfConcept | `semanticQuery(topK:5)` brut | `rawVector` + `finalPersonalized` (pipeline complet) ✅ |

`runRecommendationFromPlan` (`recommendation-service.ts`) est proprement extrait : accepte un `RecommendationQueryPlan`, gère semantic → text → popularity fallback → `SCORE_MODEL_V2` → diversité. Tous les entry-points l'appellent. La chaîne de fallback est correcte et tracée via `stageAvailability` + `fallbackFlags`.

#### Acceptance criteria

| Critère | Statut |
|---|---|
| Preview ShelfConcept : deux modes nommés `rawVector` / `finalPersonalized` | ✅ |
| `finalPersonalized` utilise le même scorer que la production | ✅ — même `runRecommendationFromPlan` |
| `/v1/personalized` n'utilise plus le top-popularité comme candidate pool | ✅ — popularité n'est plus que composante V2 |
| Shelf depuis seeds utilise embeddings + profil + V2 | ✅ — `buildSeedQueryPlan` + pipeline central |
| Cohérence de scoring quel que soit l'entry-point | ✅ — même weights V2 partout |
| Debug output : intention → pool → score V2 → filtres → résultat | ✅ — `queryPlan`, `stageAvailability`, `fallbackFlags`, `timing.stages` |
| Aucun endpoint n'annonce V1 en exécutant V2 | ✅ — `SCORE_MODEL_V1` marqué `@deprecated`, plus utilisé |

---

### 2. Qualité du code

**Points forts :**

- `recommendation-service.ts` est compact (180 lignes), lisible, sans magie cachée.
- `buildProfileQueryPlan` et `buildSeedQueryPlan` sont de bons helpers : logique d'agrégation explicite, retournent un `RecommendationQueryPlan` standard.
- Cold-start bien géré : intent vide → skip semantic → popularity fallback → V2 quand même appliqué.
- `runHybridReranker` n'est pas mocké dans les tests du service central, ce qui valide le comportement réel du V2.
- Seed exclusion correcte (`seedIdSet.has(c.id)` appliqué post-rerank).
- `SCORE_MODEL_V1` conservé mais `@deprecated`, pas supprimé (bonne pratique de rétrocompatibilité test).

**Observations mineures (non bloquantes) :**

**A. `freshnessPolicy` du ShelfConcept non transmise dans le plan de preview**

`shelf-concepts.ts:90-104` construit le plan avec `hardFilters: {}` et `softPreferences: {}` constants. Or `concept.freshnessPolicy` est disponible dans le schema (`schema.ts:231`). Le ticket (section 2) stipule explicitement : *"Le concept doit utiliser son `semanticIntent`, ses media types, freshness policy, hard filters/contraintes pertinentes."*

La `freshnessPolicy` est ignorée. Impact limité (la preview reste fonctionnelle), mais c'est un écart de spec. À corriger si `RecommendationQueryPlan` expose un champ pour ce signal — à défaut, documenter pourquoi c'est différé.

**B. Tests d'intentions ambiguës incomplets**

Le ticket (section 5, dernier bullet) demande explicitement des tests sur `Aventures à travers le temps`, `Épopées modernes`, `film qui retourne le cerveau`. L'implémentation n'en couvre qu'un, avec des seed IDs fictifs et un `skipIf(!canRun)` qui le rend inactif en CI. Les deux autres exemples sont absents. La couverture fonctionnelle du service (promotion de rang vector→V2) est bien testée dans `recommendation-service.test.ts`, mais les cas d'intentions sémantiquement ambigu·es restent non couverts.

---

### 3. Sécurité / Régressions

- Aucun secret dans les logs.
- Validation des entrées : `profileId` est validé (UUID, presence check DB) dans `/v1/personalized`; `profileId` et `id` validés dans le preview.
- Aucune suppression ou mutation destructive non contrôlée.
- Le refactor est bien borné aux fichiers liés à la recommandation. Pas de modification transversale imprévue.
- `shelf-instances.ts` : changement minimal (passage du `log`), sans risque.

---

### 4. Scope

L'implémentation respecte le périmètre du ticket. Les items hors scope (Home shelves, contextual reco fiche film, cache/invalidation, inter-shelf diversity) ne sont pas touchés.

---

### 5. Synthèse

L'extraction de `runRecommendationFromPlan` est propre et bien conçue. Les quatre parcours convergent sur le même scorer. Les metadata sont cohérentes. Le cold-start est géré. Les tests unitaires valident le comportement de promotion V2. Les deux observations (freshnessPolicy non wired, tests d'ambiguïté incomplets) sont mineures et ne compromettent pas le comportement core.

IMPLEMENTATION_APPROVED
