Aucune erreur TypeScript. Voici le résumé des changements appliqués :

---

## Corrections appliquées

### Fix optionnel 1 — `enrichWithRetry` n'effectue plus de retries sur les erreurs non-transientes

**`metadata-enrichment-service.ts`**
- `EnrichResult` : ajout de `'terminal-failed'` (erreur non-transiente, pas de retry) aux côtés de `'provider-failed'` (transiente, retryable).
- `persistFailure()` : retourne maintenant `{ retryable: boolean }` au lieu de `void`.
- `enrichMovie` et `enrichSeries` : chaque `catch` utilise la valeur retournée pour décider entre `'provider-failed'` (transient → retry dans `enrichWithRetry`) et `'terminal-failed'` (terminal → court-circuit immédiat).

`enrichWithRetry` n'a **pas besoin d'être modifié** : son check existant `if (result !== 'provider-failed') return result` interrompt déjà les retries pour `'terminal-failed'` sans changement de code.

### Fix optionnel 2 — `embeddingBlocked` documenté

**`catalog-stats.ts`** : commentaire ajouté sur les deux lignes `embeddingBlocked` (movies et series) expliquant qu'il est structurellement 0 tant que la politique d'éligibilité embedding ne dépasse pas `metadataEnrichedAt IS NOT NULL`.

### Tests mis à jour

**`metadata-enrichment-service.test.ts`** + **`t115-enrichment.test.ts`** : assertions et noms de tests mis à jour pour refléter la distinction `terminal-failed` / `provider-failed`.

---

**Point bloquant restant** (inchangé, non-code) : exécuter `POST /admin/catalog-enrich-missing` contre la production et publier les résultats before/after dans `runs/T115/`.
