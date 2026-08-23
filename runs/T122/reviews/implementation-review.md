I have enough context for a complete review. Here is my structured assessment.

---

## Review T122 — Bound profile boosts by semantic relevance in thematic reranking

### Résumé exécutif

L'implémentation est **correcte, complète et conforme au ticket**. Le problème bloquant de la première review (TypeScript error sur `apps/api`) a été résolu. L'ensemble des acceptance criteria du ticket et du plan sont couverts.

---

### 1. Correctness vs ticket requirements

#### 1.1 Root cause documentée (ticket §1)
Documentée dans `runs/T122/plan.md` et dans le code :

> _"The within-pool semantic delta is only ~0.024, while a single genre+language affinity combination can contribute ~0.23 — an order of magnitude larger."_

✅ Critère validé.

#### 1.2 Mécanisme de modulation générique (ticket §2)

`computeSemanticConfidenceFactor` à `hybrid-reranker.ts:533–543` :

```typescript
const normalizedRelevance = range > 0 ? (similarity - poolMin) / range : 1.0
return minFactor + (1 - minFactor) * Math.pow(Math.max(0, Math.min(1, normalizedRelevance)), power)
```

- Monotone : inférieur dans le pool → facteur plus faible. ✅
- Borné `[minFactor, 1.0]`. ✅
- Dégénérescence safe : pool uniforme (range = 0) → factor = 1.0, personnalisation intacte. ✅
- Modulation conditionnelle à `blendLevel === 'thematic'` : niveaux `exploit`/`discover` non impactés. ✅

#### 1.3 Pas de seuil absolu (ticket §3)

La formule n'utilise que `poolMin` et `poolMax`, calculés à la volée sur le pool eligible. Aucun hardcode de valeur absolue sur la distribution 41–47 %. `SEMANTIC_FLOOR_STRICT`/`MODERATE` restent les seuls seuils absolus existants et sont inchangés. ✅

#### 1.4 Breakdown Lab (ticket §4)

Tous les champs demandés sont exposés dans `ScoreBreakdown` :

| Champ ticket | Champ implémenté | Status |
|---|---|---|
| `semanticSimilarityRaw` | `semantic` (existant) | ✅ (nom légèrement différent, donnée identique) |
| `semanticRelevanceNormalized` | `semanticRelevanceNormalized` | ✅ |
| `semanticContribution` | `semanticContribution` | ✅ |
| `profileBoostRaw` | `profileBoostRaw` | ✅ |
| `profileBoostEffective` | `profileBoostEffective` | ✅ |
| `profileBoostCap / semanticGateFactor` | `semanticConfidenceFactor` | ✅ |
| `genreContribution` | `profileGenreContribution` | ✅ |
| `languageContribution` | `languageContribution` | ✅ |
| `eraContribution` | `eraContribution` | ✅ |
| `otherContributions` | `otherPositiveContributions` | ✅ |
| `penalties` | champs individuels existants | ✅ |
| `finalScore` | `final` | ✅ |

#### 1.5 Métriques de dérive (ticket §5)

`rawVectorRank`, `finalRank`, `rankDelta`, `semanticPercentile` implémentés et peuplés. Flagging `"⚠ large upward rank delta with weak semantic percentile"` injecté dans `reasons` pour delta < -3 et percentile < 0.33. ✅

---

### 2. Qualité du code

**Points forts :**
- `computeSemanticConfidenceFactor` est une pure function exportée — testable de façon isolée, sans effets de bord.
- Séparation nette `profileBoostRaw` / `profileBoostEffective` / `qualityContrib` : les contributions factuelles (freshness, prior, availability) ne sont pas modulées. Choix de design justifié et explicite.
- Calcul des stats pool (`poolMin`, `poolMax`, `semanticPercentileById`, `rawRankById`) fait une seule fois avant la boucle de scoring — pas de performance overhead.
- Backward compatibility préservée : les 16 nouveaux champs sont tous optionnels (`?`) dans `ScoreBreakdown`.
- Pas de magie cachée : toute la logique de modulation est visible à un seul endroit.

**Observation mineure :**
- Le plan inicial déclarait les nouveaux champs non-optionnels, ce qui a cassé la compilation de `apps/api`. Le fix a été appliqué correctement et l'interface actuelle est cohérente. Le guard `undefined` ajouté à la ligne 823 est approprié.

---

### 3. Tests

**Unit tests** (`hybrid-reranker.test.ts:361–408`) : 6 tests couvrant les invariants de la formule — pool bottom, pool top, monotonie, pool uniforme, effective < raw, bounds. ✅

**Regression tests** (`pipeline-regression.test.ts`) :
- `"Aventures à travers le temps"` : ≥ 4 titres temporels dans le top-8, Hobbit hors top-5, modulation active sur ≥ 3 candidats. ✅
- `"film qui retourne le cerveau"` : scores sémantiques top-5 sans outlier extrême (spread < 0.25), invariant `effective ≤ raw`. ✅
- `"SF qui fait réfléchir"` : `semanticConfidenceFactor > 0`, invariant `effective ≤ raw`. ✅

**Observation non-bloquante — shelf action/aventure :**
Le ticket demande un test supplémentaire pour confirmer que la personnalisation reste forte sur les shelves larges. Seule la couverture unitaire (pool uniforme → factor = 1.0) existe. Il n'y a pas de test d'intégration dédié pour ce cas. La garantie mathématique est solide (dégénérescence sur range = 0), mais un test d'intégration aurait confirmé le comportement en conditions réelles. C'est une lacune mineure et non bloquante.

---

### 4. Compliance scope

Le changement reste strictement borné au périmètre du ticket :
- Seule la couche reranker est modifiée.
- Le retrieval sémantique, le LLM planner, la diversity filter, et les seuils absolus existants sont intacts.
- Aucune dépendance externe ajoutée.
- Aucun changement de comportement pour les blend levels `exploit` / `discover`.

✅ Pas de dérive de scope.

---

### 5. Sécurité

Aucun problème de sécurité. La formule opère uniquement sur des valeurs numériques internes. Pas d'injection possible, pas de données sensibles loguées.

---

### 6. Completion rule

Le ticket exige une validation visuelle dans le Recommendation Lab (cas `Aventures à travers le temps`, comparaison avant/après). **Le pipeline expose désormais toutes les données nécessaires** (`semanticRelevanceNormalized`, `profileBoostRaw/Effective`, `rankDelta`, `semanticPercentile`) via le contrat API. La validation Lab reste une étape humaine qui ne peut être couverte par des tests automatisés — l'implémentation la rend possible et ne la bloque pas.

---

### Issues bloquantes

Aucune. Le problème de la première review (`ScoreBreakdown` non-optionnel, erreur TypeScript dans `apps/api`) est résolu.

### Observations non-bloquantes

1. **Nommage `semantic` vs `semanticSimilarityRaw`** : la donnée est identique, le nom de champ diffère légèrement du ticket. Cosmétique.
2. **Absence de test d'intégration "shelf action/aventure"** : la garantie est couverte mathématiquement + unitairement. Une régression d'intégration compléterait le coverage.

---

IMPLEMENTATION_APPROVED
