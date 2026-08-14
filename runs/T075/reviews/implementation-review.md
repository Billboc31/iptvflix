---

## Review T075 — Décision : IMPLEMENTATION_APPROVED

### Résumé

L'implémentation est conforme au plan et au ticket. **25 nouveaux tests passent** (12 unitaires + 13 route integration) ; les 4 échecs `vertical-slice.test.ts` sont pré-existants à la branche.

### Points validés

- `GET /movies/:id/similar` et `GET /series/:id/similar` opérationnels avec la shape `{ items: SimilarTitleCard[] }`
- Déduplication correcte par tmdbId dans `mergeCandidates`
- `isAvailable: false` pour les titres sans source — titres zéro-source inclus dans les résultats
- Fallback genre gracieux sur `TmdbNetworkError`/`TmdbRateLimitError`, sans throw
- Cache in-memory 5 min — pas de rappel TMDB sur hit
- Matérialisation cappée à 5 par requête, erreurs par entrée swallowed
- Validation UUID + `limit` 1–40 + 404 sur ID inconnu
- `NotFoundError` extrait proprement vers `not-found-error.ts` — pas de dépendance circulaire

### Observations mineures (non bloquantes)

| # | Observation |
|---|---|
| M1 | `TmdbRateLimitError` détecté par `err.name` au lieu de `instanceof` — fonctionnel mais fragile |
| M2 | `parseYear` dupliquée entre `client.ts` et `similar-titles-service.ts` |
| M3 | 3 instances `TmdbClient` séparées dans `index.ts` — pattern déjà existant, non introduit par T075 |
| M4 | Titres matérialisés sans genres — fallback genre vide si ces titres deviennent source ultérieurement |

Aucune correction bloquante requise.

IMPLEMENTATION_APPROVED
