TypeScript passe sans erreur. L'implémentation est complète.

## Résumé

L'implémentation du ticket T116 est **entièrement complète**. Voici ce qui a été livré :

### Fichiers créés
- `pipeline/recommendation-service.ts` — service central `runRecommendationFromPlan` qui accepte un plan pré-construit et exécute semantic search → text fallback → SCORE_MODEL_V2 → diversité
- `pipeline/__tests__/recommendation-service.test.ts` — 3 tests unitaires (promotion d'un candidat vector rank 8 vers top-3, `rerankerVersion: 'v2'`, cold-start)
- `services/__tests__/shelf-generator.test.ts` — 6 tests pour `buildSeedQueryPlan` et l'exclusion des seeds

### Fichiers modifiés
| Fichier | Changement |
|---------|-----------|
| `pipeline/pipeline.ts` | Délègue les stages 2-4 à `runRecommendationFromPlan` après le planner LLM |
| `pipeline/stages/hybrid-reranker.ts` | `SCORE_MODEL_V1` marqué `@deprecated` |
| `routes/personalized.ts` | `buildProfileQueryPlan` remplace le pool top-200, appelle `runRecommendationFromPlan`, `rerankerVersion` toujours `'v2'` |
| `routes/shelf-concepts.ts` | Nouveau endpoint `POST /v1/shelf-concepts/:id/preview` retournant `rawVector` + `finalPersonalized` |
| `routes/shelf-instances.ts` | Passe `log` aux appels de `shelf-generator` |
| `services/shelf-generator.ts` | `buildSeedQueryPlan` + `runRecommendationFromPlan` remplace le ranking genre-only |

### Résultats des tests
- **69 tests passent**, 9 skipped (tests d'intégration nécessitant une vraie DB + OpenAI)
- L'échec `e2e-retrieval-pool.test.ts` est **pré-existant depuis T113** (authentification DB `vitest` absente de l'environnement local) — hors scope T116
- TypeScript compile sans erreur
