I now have enough information to write the full review.

---

## Résumé

L'implémentation livre la consolidation complète demandée par T111 : le `recommendation-engine` dispose désormais d'un planner LLM réel, d'une recherche sémantique pgvector/cosine réelle et d'un hybrid reranker complet. Le Lab et Home délèguent tous les deux au moteur via un client avec circuit breaker, avec fallback local préservé.

---

## Vérifications effectuées

- Diff complet des fichiers source modifiés (`apps/api/src/`, `apps/recommendation-engine/src/`, `packages/api-contracts/src/`)
- Lecture des routes clés (query, personalized, shelf-concepts, shelf-instances)
- Lecture du pipeline et de chaque stage (llm-planner, semantic-search, hybrid-reranker)
- Lecture du client API et du circuit breaker
- Lecture des contrats (`EngineMetadata`, exports)
- Lecture des tests de délégation
- Vérification des points de risque SQL injection

---

## Points validés

**Critères d'acceptation satisfaits :**

1. **Engine sans stub** — `llm-planner.ts` fait un vrai appel OpenAI avec parsing/validation JSON structuré + fallback. `semantic-search.ts` exécute une vraie requête cosine (pgvector si disponible, sinon cosine PL/pgSQL). `hybrid-reranker.ts` implémente le scoring multi-signaux complet (sémantique, genre, people, freshness, availability, prior).

2. **Lab → Engine** — `recommendation-lab.ts` appelle `RecommendationEngineClient.query()` en premier avec `source: 'ENGINE'` sur les résultats. Fallback local uniquement si l'engine retourne `null`.

3. **Home → Engine** — `recommendations.ts` appelle `RecommendationEngineClient.personalized()` en premier. Fallback local préservé.

4. **Pas de suppression prématurée** — les services API sont marqués `@deprecated` avec pointeurs vers l'engine, non supprimés, ce qui est conforme au ticket ("Remove dead/duplicate code only after callers have migrated and tests prove equivalence").

5. **Circuit breaker** — implémenté correctement avec half-open state (`circuitOpenUntil = 0; failureCount = 0` sur reset), timeout 15 s, seuil de 3 échecs / cooldown 30 s.

6. **Observabilité** — `EngineMetadata` propagé dans toutes les réponses (Lab, Home, personalized) : `engineVersion`, `embeddingModelVersion`, `plannerModelVersion`, `rerankerVersion`, `timingsMs`, `fallbackFlags`.

7. **Contrats versionnés** — `packages/api-contracts/src/engine-metadata.ts` + exports dans index.

8. **Tests de délégation** — `recommendation-engine-delegation.test.ts` vérifie que Lab et Home appellent le même engine, retournent le même `engineVersion`, et que les résultats viennent de l'engine.

9. **Validation des mediaTypes** — Zod enum `z.enum(['movie', 'series'])` dans toutes les routes engine ; la valeur ne peut pas contenir de SQL arbitraire.

10. **Autorisation profile** — le moteur vérifie l'existence du `profileId` avant traitement (query route : `SELECT id FROM profiles WHERE id = $1`). `refreshGeneratedShelf` vérifie `shelf.profileId !== profileId` → `ForbiddenError`.

---

## Problèmes détectés

### Observation 1 — Pattern SQL à risque (non bloquant)

`semantic-search.ts:83–85` :
```ts
const allowedTypes = mediaTypes.map((t) => `'${t}'`).join(', ')
// ...
AND me.media_type IN (${pgClient.unsafe(allowedTypes)})
```

**Pourquoi non bloquant** : `mediaTypes` est validé par Zod avec `z.array(z.enum(['movie', 'series']))` avant d'atteindre ce code. Les valeurs ne peuvent être que les chaînes littérales `movie` ou `series`.

**Pourquoi à signaler** : ce pattern est fragile si la validation est contournée ou si d'autres valeurs sont ajoutées à l'enum sans mise à jour du SQL. Préférer une liste de paramètres fixes ou une whitelist explicite.

### Observation 2 — Sélection du modèle dans `generateConcepts` (mineur)

`shelf-concept-generator.ts` :
```ts
model: this.openai.apiKey ? (process.env.SHELF_CONCEPT_LLM_MODEL ?? 'gpt-4o-mini') : 'gpt-4o-mini',
```

`this.openai` n'est non-null que si `OPENAI_API_KEY` est configuré (voir `buildService()`), donc `this.openai.apiKey` est toujours truthy à ce point. La condition est redondante et `process.env.SHELF_CONCEPT_LLM_MODEL` est accédé directement au lieu d'utiliser la constante `SHELF_CONCEPT_LLM_MODEL` importée depuis `config.ts`. Sans impact fonctionnel, mais incohérent avec le reste de la base de code.

### Observation 3 — Scan complet des tables de genres dans `shelf-generator.ts` (performance)

```ts
db.select({ movieId: movieGenres.movieId, genreId: movieGenres.genreId }).from(movieGenres),
db.select({ seriesId: seriesGenres.seriesId, genreId: seriesGenres.genreId }).from(seriesGenres),
```

Pas de clause WHERE → scan complet des tables de jonction genre. Acceptable à l'échelle actuelle (MVP), mais à adresser si le catalogue croît significativement.

### Observation 4 — `console.warn/error` dans `ShelfConceptGeneratorService`

Le service utilise `console.warn` et `console.error` au lieu du logger Fastify. Acceptable (pas de request context), mais devrait être aligné avec les conventions du projet à terme.

### Observation 5 — Typage lâche sur les shelf concepts côté client

`EngineShelfConceptsResult.concepts: unknown[]` — le client API passe les concepts directement sans adaptation. Un type partagé (`ShelfConcept[]`) éviterait les régressions silencieuses si le format change.

### Observation 6 — Règle de complétion non vérifiable par code review

Le ticket exige : *"Run `SF qui fait réfléchir` with a real Profile through the Lab and through the product integration and demonstrate both paths invoke the same engine version."* Cette démonstration runtime n'est pas réalisable dans une review de code, mais doit être effectuée avant clôture du ticket.

---

## Risques éventuels

- **Engine interne non authentifié** : les routes `/v1/shelf-instances/*` et `/v1/shelf-concepts/*` de l'engine acceptent un `profileId` dans le body sans authentification. Acceptable pour un service interne uniquement, mais à protéger (réseau interne / secret partagé) avant exposition hors du cluster.

- **Démo de la règle de complétion** : la règle de complétion du ticket exige une démonstration runtime qui doit être faite par l'équipe, pas par la review de code.

---

## Décision

L'implémentation est correcte, complète et bien structurée. Tous les critères d'acceptation structurels sont satisfaits. Les observations ci-dessus sont mineures ou hors scope d'une review de code. La règle de complétion runtime reste à démontrer par l'équipe.

IMPLEMENTATION_APPROVED
