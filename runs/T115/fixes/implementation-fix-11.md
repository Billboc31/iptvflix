# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T115/reviews/implementation-review.md
- generated at: 2026-08-19T15:29:07Z

---

# PR Review — T115 — Complete catalog enrichment and refresh failure observability

## Résumé

L'implémentation code est fonctionnellement complète. Tous les 4 fixes des reviews précédentes sont confirmés. La qualité est solide : pagination keyset correcte, classification transient/terminal, schema `enrichment_failures` conforme, routes admin complètes, stats catalog étendues, source de vérité unique pour l'eligibilité embedding.

Deux problèmes subsistent, dont un bloquant identique à la review précédente.

---

## Points validés

- **Fix 1** — `retryFailures` filtre par `retryable: true` par défaut (`if (!force) conditions.push(...)`).
- **Fix 2** — Échecs de saisons persistés dans `enrichment_failures` via `persistFailure(stage: 'seasons')`, `clearFailure` conditionnelle.
- **Fix 3** — `console.warn` dans les catch blocks collection upsert et `persistFrenchLocalization`.
- **Fix 4** — `fullyEnriched` défini/documenté en commentaire inline.
- Keyset cursor `id ASC`, sans offset drift — correct.
- `classifyError` capture le root cause réel, plus le SQL généré.
- `embeddingPending` calculé via `NOT EXISTS (... media_embeddings ...)`, jamais hardcodé à 0.
- Migrations 0046 + 0047 présentes et cohérentes dans le journal.
- Tests normalization et enrichment : couvrent les cas critiques.

---

## Problèmes détectés

### 🔴 BLOQUANT — Production run non exécutée (persistant depuis review 10)

L'artefact `runs/T115/production-run-20260819.md` a été créé mais **documente un run sur 6 films de dev local** — pas une production run ni un snapshot équivalent. L'artefact lui-même l'indique : *"Production API not DNS-resolvable from this environment; Fly.io unauthenticated."*

La completion rule est non-négociable : *"Run the new enrichment mode against production **or an equivalent restored production snapshot**."*  Un DB local de 6 films (dont 1 avec TMDB ID synthétique 99999999) n'est pas un snapshot équivalent. Les 126 vraies failures de production restent indiagnostiquées.

**Action requise** : Restaurer un snapshot de la DB production localement (`pg_restore`), appliquer les migrations 0044–0047, exécuter le playbook, publier les compteurs réels (~60k films) et les causes des vraies failures.

### 🟠 Anomalie — `retryFailures force=true` retourne `queued: 0` avec 1 failure présente

Avec 1 failure dans `enrichment_failures` et `force=true` qui retire le filtre `retryable`, `queued` devrait être 1. Retourner 0 est incohérent avec l'implémentation (`if (!force) conditions.push(...)`). Vérifier si c'est un bug dans la construction de la liste d'IDs à retry, un conflit de run concurrent, ou une sémantique différente de `queued`.

---

## Décision

IMPLEMENTATION_FIX_REQUIRED
