I have a complete picture. Let me write the structured review.

---

## PR Review — T127: Build a true must-watch Hero ranker for Home

### Résumé

Cette révision fait suite à la review précédente qui avait émis un `IMPLEMENTATION_FIX_REQUIRED` pour un test #7 sémantiquement incorrect. Le fix a été appliqué (commit `e49c432c` + ajustement de la fixture dans `e4e36616`). L'implémentation complète est évaluée ici, incluant la correction.

---

### Vérifications effectuées

- Lecture complète de `hero-selector.ts` (144 lignes) — logique de ranking, formule, observabilité
- Lecture complète de `hero-selector.test.ts` (475 lignes) — tous les tests #1–#9 + tests infrastrucure
- Vérification du fix sur le test #7 (fixture `languageAffinity`)
- Vérification de `env.ts` — HERO_SCORE_WEIGHTS, HERO_MIN_SCORE, HERO_POOL_SIZE
- Vérification de `ShelfCandidateItem` dans `recommendation-engine-client.ts` (lignes 68–78)
- Vérification de l'intégration `selectHero` dans `home-pool-service.ts`
- Vérification des formules arithmétiques dans les commentaires de test
- Vérification de la structure du log `[HERO_RANKING]`

---

### Points validés

**Fix du problème bloquant (test #7)**

La fixture a été corrigée conformément à la demande de la review précédente :

```typescript
// Avant (incorrect) :
// "Parasite" avait languageAffinity: 0.95 — contradiction sémantique

// Après (correct) :
makeCandidate({ mediaId: MEDIA_ID_A, profileScore: 0.92, semanticScore: 0.80,
                qualityPrior: 0.90, languageAffinity: 0.10, finalScore: 0.92 })
// A gagne avec heroScore = 0.45*0.92 + 0.25*0.80 + 0.20*0.90 + 0.10*0.10 = 0.804

makeCandidate({ mediaId: MEDIA_ID_B, profileScore: 0.65, semanticScore: 0.60,
                qualityPrior: 0.50, languageAffinity: 0.90, finalScore: 0.65 })
// B perd avec heroScore = 0.45*0.65 + 0.25*0.60 + 0.20*0.50 + 0.10*0.90 = 0.6325
```

"Parasite" (langue étrangère → faible `languageAffinity: 0.10`) bat le film domestique (fort `languageAffinity: 0.90`) parce que son `profileScore` est matériellement plus élevé. Le test prouve maintenant réellement l'absence de hard-filter par langue. ✓

**Formule heroScore**

- Poids normalisés : `0.45 + 0.25 + 0.20 + 0.10 = 1.0` ✓
- `profileRelevance: 0.45` dominant — conforme à "personal relevance remains primary" ✓
- Version `v1` labellisée, exportée depuis `env.ts` ✓
- `computeHeroScore()` est une pure function exportée, testable isolément ✓

**Logique de sélection**

- Pool de 15 candidats (`HERO_POOL_SIZE` env-configurable) ✓
- Éligibilité séquentielle : `available && finalScore >= HERO_MIN_SCORE` → dislikes (DB) → `title && backdropUrl` (enrichment) ✓
- Tri descendant par `heroScore`, sélection de `ranked[0]` — plus de premier-éligible ✓
- `null` retourné si aucun candidat passe tous les gates ✓
- `HERO_MIN_SCORE` env-configurable ✓

**Couverture des requirements ticket**

| Requirement ticket | Couverture |
|---|---|
| Pas de premier-éligible automatique | Tests #1, #2 ✓ |
| Formule dédiée versionnée | `HERO_SCORE_WEIGHTS v1` + test #9 ✓ |
| Pool évalué (N candidats) | HERO_POOL_SIZE=15, test #2 (index 7/10 gagne) ✓ |
| Profilerelevance primaire | Poids 0.45 dominant ✓ |
| Langue étrangère possible | Test #7 corrigé ✓ |
| Null si aucun candidat suffisant | Tests #6 (null), #8 (tous sans backdrop → null) ✓ |
| Disliked ne peut pas gagner | Tests #4, gate dédié ✓ |
| Unavailable exclu | Test #5 ✓ |
| Sans backdrop exclu | Tests #6 (individuel), #8 (tous) ✓ |
| Stabilité snapshot 24h | Tests dédiés dans `home-snapshot.test.ts` ✓ |
| Observabilité debug | Log `[HERO_RANKING]` complet ✓ |
| Pas de hardcoding pays/titre | Aucun trouvé ✓ |

**Arithmétique des tests — vérification**

- Test #1 : Film C (0.45×0.9+0.25×0.8+0.20×0.5+0.10×0.5 = 0.755) > Film A (0.62) ✓
- Test #3 : Film B (0.45×0.80+0.25×0.8+0.20×0.95+0.10×0.5 = 0.80) > Obscure Film (0.6525) ✓
- Test #7 : Parasite (0.804) > Domestic (0.6325) ✓
- Test #9 : 0.5×0.8+0.3×0.6+0.15×0.7+0.05×0.4 = 0.705 ✓

**Intégration et robustesse**

- `selectHero()` appelé avant exclusion du rail "Pour toi" → pas de doublon hero/premier-item ✓
- Erreur catchée dans `home-pool-service.ts`, fallback `hero=null` sans crash ✓
- `ShelfCandidateItem` étendu avec `qualityPrior` et `languageAffinity` ✓

**Observabilité**

Log `[HERO_RANKING]` expose toutes les données demandées par le ticket : pool size, eligible count, winner mediaId+title, heroScore, version des poids, tableau complet des candidats avec tous les sous-scores et flag `selected`. Aucune donnée sensible exposée. ✓

---

### Problèmes détectés

Aucun problème bloquant.

---

### Risques éventuels

- **Observation persistante — poids non env-configurables** : `HERO_SCORE_WEIGHTS` est hardcodé en code (non lisible depuis des env vars individuelles). Le versioning (`v1`) est satisfait, mais changer les poids nécessite un déploiement. Acceptable pour v1.

- **Observation persistante — pas de test explicite media type gate** : les types non supportés (ex: `EPISODE`) tombent implicitement de `enrichMap`. Le comportement est correct mais non testé explicitement. Non-bloquant.

- **Pas de risque sécurité** : le log `[HERO_RANKING]` n'expose que mediaIds, titres, et scores numériques.

---

### Décision

Le problème bloquant de la review précédente (fixture test #7 sémantiquement incorrecte) est résolu. La fixture actuelle prouve réellement que le contenu en langue étrangère (`languageAffinity: 0.10`) peut gagner grâce à un `profileScore` supérieur — absence confirmée de hard-filter linguistique.

Tous les requirements du ticket sont couverts par l'implémentation et les tests. L'architecture est propre, bornée au scope du ticket, et la stabilité snapshot est préservée.

IMPLEMENTATION_APPROVED
