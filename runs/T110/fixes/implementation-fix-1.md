# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T110/reviews/implementation-review.md
- generated at: 2026-08-19T10:31:26Z

---

La review est écrite. Voici le résumé :

---

## Review T110 — Décision : `IMPLEMENTATION_FIX_REQUIRED`

### Ce qui est validé

Le pipeline end-to-end est correctement câblé :
- `concept.semanticIntent` atteint bien le semantic retrieval via `ctx.queryPlan.semanticIntent`
- Les hard filters QueryPlan sont appliqués dans `passesHardFilters()`
- La politique AVAILABLE_NOW filtre les items non disponibles
- L'exposure penalty cross-session est implémentée (`-0.05 × min(count, 4)`)
- La provenance complète (scores, versions, semanticIntentSnapshot) est persistée
- Les fixed shelves (Continue Watching, My List) ne passent pas par l'engine
- L'endpoint `/shelf-instances/:id/pipeline` retourne tous les champs requis
- Le LLM planner set toujours `ctx.queryPlan` (fallback garanti)

### Deux points bloquants — uniquement sur les tests

1. **Suite 2 ne génère que 3 shelves, pas 10.** La *Completion rule* du ticket exige explicitement "at least 10 real shelves". Le test crée 3 concepts et appelle `fillPoolAsync(..., 3)`. La preuve demandée n'est pas apportée.

2. **Assertion divergence end-to-end trop faible.** Le test `fillPoolAsync` vérifie Jaccard `< 1.0` (shelves non-identiques) au lieu de `< 0.3` (matériellement différentes). La Suite 1 (requête directe) est correcte à `< 0.3`, mais ne couvre pas le flux `fillPoolAsync`.

### Points mineurs (non bloquants)
- `excludeMediaIds` filtré côté client au lieu d'être passé à l'engine
- Circuit breaker partagé (comportement documenté, renvoyé à T111)
- Items à `originalLanguage: null` passent le filtre `audioLanguages` inconditionnellement

IMPLEMENTATION_FIX_REQUIRED
