# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:45:05Z

---

## PR Review — T115

**Révision** : #13 (review-attempt-13.md). Aucun changement de code depuis la révision #12 — seul l'artefact `production-run-20260819.md` est nouveau.

---

## Vérifications effectuées

- Code des 8 composants du plan (TMDB client, metadata-enrichment-service, catalog-enrich-missing-service, routes, catalog-stats, embedding-eligibility, schéma DB, migrations 0046+0047)
- Artefacts de run locaux (`local-validation-run-20260819.md`, `production-run-20260819.md`)
- Fix coder-12 (commit `26046f48`) — `force` param sur `/retry-failures`
- Completion rule du ticket

---

## Points validés

- **Normalisation TMDB** — `runtime === 0 → null`, `imdb_id === "" → null`, `overview?.trim() || null` appliqués dans `mapMovieDetail` et `mapSeriesDetail`. ✅
- **`classifyError()`** — extrait le vrai `constructor.name`, `.code`, `.message`. Pas de "Failed query: …" ✅
- **`persistFailure()` / `clearFailure()`** — upsert sur `(media_type, media_id)`, incrémente `retry_count`, nettoyage sur succès. ✅
- **Keyset cursor** — `WHERE id > lastId ORDER BY id ASC` — pas de drift d'offset, idempotent. ✅
- **Fix coder-12 confirmé** — `POST /retry-failures {"force": true}` retourne `{"queued": 1}` pour une failure `retryable: false`. ✅
- **Migrations 0046 + 0047** — `IF NOT EXISTS` safe, journal mis à jour, pas de conflit avec T114. ✅
- **Catalog-stats** — `neverEnriched`, `partiallyEnriched`, `fullyEnriched`, `stale`, `failedLastEnrichment`, `embeddingPending` (NOT EXISTS réel). ✅
- **`embedding-eligibility.ts`** — source de vérité unique (`isEmbeddingEligible`, `EMBEDDING_ELIGIBLE_SQL_PREDICATE`, `embeddingEligibleCondition`). ✅
- **Run local** — 5 films, 39 séries, 444 épisodes traités ; 0 failures ; idempotence confirmée (re-run skip les lignes enrichies). ✅
- **Observabilité des failures** — `stage: "fetch"`, `errorClass`, `errorMessage`, `retryCount`, `occurredAt`, `retryable` présents dans la réponse JSON. ✅

---

## Problèmes détectés

### 🔴 BLOQUANT — Completion rule non satisfaite (13e cycle)

Le ticket stipule explicitement :

> *"Do not close after unit tests. Run the new enrichment mode against production (or an equivalent restored production snapshot), publish before/after counts, and show the remaining terminal failures with their real causes."*

L'artefact `production-run-20260819.md` documente un run sur **6 films en base locale** avec un TMDB ID synthétique (99999999). Ce n'est pas un run sur le catalogue de production (~60k films, ~5k séries). Les 126 vraies failures de production restent indiagnostiquées, et aucun `before/after count` réel n'est publié.

**Ce blocker est exclusivement environnemental** : l'IA n'a pas accès à `DATABASE_URL` production, ni à Fly.io/Railway. Le code lui-même est correct et approuvable sur la base technique.

---

### 🟡 Observations non bloquantes (identiques aux reviews précédentes)

- **`retrying` stat** — accumulateur incrémental sans décrément ; sémantique légèrement trompeuse mais non bloquant.
- **Test cursor pagination** — valide uniquement `countEligible`, pas le comportement `WHERE id > lastId`.
- **Seuil staleness hardcodé** — `30 * 86_400_000` ms dupliqué dans le service et catalog-stats ; centralisation possible mais hors scope du ticket.

---

## Risques éventuels

Aucun risque de régression code détecté. Les migrations sont idempotentes. Le rollback en cas de problème production se fait en ignorant les nouvelles routes (elles ne remplacent pas les routes existantes).

---

## Décision

L'implémentation technique est complète, correcte et conforme au plan. Elle satisfait tous les critères d'acceptance **sauf le dernier** qui exige une démonstration sur le catalogue de production réel.

**Action requise — humain uniquement** :

1. Fournir `DATABASE_URL` production (Railway/Fly.io) pour un restore local, **ou**
2. Exécuter `fly auth login` / `railway login` dans ce terminal, **ou**
3. Exécuter manuellement le playbook `runs/T115/production-run-playbook.md` depuis un accès production.

Sans cette action, la completion rule du ticket ne peut pas être satisfaite par l'IA dans cet environnement.

IMPLEMENTATION_FIX_REQUIRED
