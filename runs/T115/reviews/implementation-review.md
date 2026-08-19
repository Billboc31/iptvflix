## PR Review — T115

**Résumé** : Review #12. Le fix `force` (coder-12) est confirmé correct. L'implémentation code est complète et de bonne qualité. Le seul blocker persistant est l'absence de production run.

---

### Points validés

- **TMDB normalization** — `runtime=0 → null`, `imdb_id="" → null`, `overview=" " → null` — correct dans `mapMovieDetail` et `mapSeriesDetail`.
- **`classifyError()`** — extrait le vrai `error.constructor.name`, `.code`, `.message`. Plus de "Failed query: …".
- **`persistFailure()`** — upsert sur `(media_type, media_id)`, incrémente `retry_count`, `clearFailure()` sur succès.
- **Keyset cursor** — `WHERE id > lastId ORDER BY id ASC`. Pas de drift offset. Idempotent.
- **Fix coder-12 confirmé** — `POST /retry-failures {"force": true}` retourne `{"queued": 1}` avec 1 failure `retryable: false`. ✅
- **Catalog-stats** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingPending` (NOT EXISTS réel, jamais hardcodé). ✅
- **`embedding-eligibility.ts`** — source de vérité unique partagée. ✅
- **Migrations 0046 + 0047** — conformes, safe en replay (`IF NOT EXISTS`). ✅

---

### Problèmes détectés

**🔴 BLOQUANT — Production run non exécutée (3e review consécutive)**

`runs/T115/production-run-20260819.md` documente un run sur **6 films en DB locale** avec un TMDB ID synthétique (99999999). L'artefact lui-même le confirme : *"Production API not DNS-resolvable; Fly.io unauthenticated."* Les 126 vraies failures de production restent indiagnostiquées.

La completion rule est non-négociable :  
> *"Run the new enrichment mode against production or an equivalent restored production snapshot…"*

**Ce blocker est environnemental, pas un défaut de code.** L'implémentation est correcte. Une action humaine est requise :
1. Fournir `DATABASE_URL` pour un restore local, **ou**
2. `fly auth login` / `railway login` dans le terminal, **ou**
3. Exécuter manuellement le playbook `runs/T115/production-run-playbook.md`.

**🟡 Observation** — `retrying` accumule les tentatives totales sans jamais décrémenter (sémantique imprécise, non bloquant).

**🟡 Observation** — Le test "cursor pagination" n'évalue que `countEligible`, pas le comportement `WHERE id > lastId` (couverture partielle).

---

**Décision** : `IMPLEMENTATION_FIX_REQUIRED` — la completion rule exige le production run. Le code lui-même est approuvable.
