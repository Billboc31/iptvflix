Rapport de test produit. Voici le résumé :

---

## Résultats — T119

**Verdict : REFUS — validation live obligatoire non effectuée**

### Tests exécutés
- **79 tests unitaires passent**, 7 skippés (requièrent `OPENAI_API_KEY` + `DATABASE_URL`)
- Aucun test en échec

### Critères d'acceptation

| AC | Description | Statut |
|---|---|---|
| AC1 | `Aventures à travers le temps` → retrieved > 0 | NON VALIDÉ (live requis) |
| AC2 | Expose `retrieved/filtered/reranked/final` | PASS (réserve mineure) |
| AC3 | Lab indique fallback + raison | PASS |
| AC4 | `candidatePoolSize` contrôle la profondeur | PASS (test unitaire) |
| AC5 | Dimensions/modèles vérifiés | PARTIEL (modèle ✓, dimension ✗) |
| AC6 | Erreurs pgvector non silencieuses | PARTIEL (erreur surfacée, diagnostics perdus dans catch) |
| AC7 | Final provient du pool sémantique | NON VALIDÉ (live requis) |
| AC8 | Trois requêtes réelles → candidats pertinents | NON VALIDÉ (live requis) |
| AC9 | Aucun secret exposé | PASS |

### Anomalies (non bloquantes)
1. `reranked` et `final` afficheront le même nombre (`outputCount` = post-limit déjà)
2. `SELECT DISTINCT detectedModels` s'exécute à chaque appel même sans mismatch (perf)
3. Le catch block ne retourne pas `diagnostics` partiels (contexte perdu si erreur pgvector)

### Pour valider

La Completion rule du ticket est claire : il faut une exécution live sur le système de production montrant `retrieved > 0` et `fallbackUsed=false` dans le Lab pour `Aventures à travers le temps`. Le rapport complet est dans `runs/T119/tests/test-report.md`.
