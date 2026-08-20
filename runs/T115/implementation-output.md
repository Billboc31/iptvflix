**Fix livré.** Voici le résumé :

**Problème trouvé** : `catalog-stats.test.ts` mockait 12 appels DB mais le route `catalog-stats.ts` en fait 13 (`seriesSeasonFailureCount` a été ajouté dans un cycle précédent sans mise à jour du test). La 13ème call non-mockée renvoyait `undefined`, `.from()` lançait une TypeError → HTTP 500 dans les deux tests.

**Fichier modifié** : `apps/api/src/routes/__tests__/catalog-stats.test.ts` — ajout d'un `setupSelectFromWhere({ cnt: 0 })` pour `seriesSeasonFailureCount` dans les deux cas de test, et mise à jour du commentaire de 12 → 13 queries.

**État des tests T115** : 33 tests passent (2 catalog-stats + 22 metadata-enrichment + 5 t115-enrichment + 4 t115-normalization).

**Bloquant restant (inchangé — action humaine requise)** : Le completion rule du ticket exige un run sur le catalogue de production. Le playbook `runs/T115/production-run-playbook.md` est prêt ; l'exécution requiert un accès Fly.io authentifié (`flyctl auth login`), inaccessible depuis l'environnement IA.
