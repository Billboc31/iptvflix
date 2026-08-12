---

# PR Review — T029: Make release lifecycle event idempotency source-aware

## Résumé

L'implémentation remplace l'unique constraint monolithique sur `release_events` par deux partial unique indexes PostgreSQL. Elle est correcte, bien bornée et répond à tous les critères d'acceptation du ticket.

## Points validés

**Conformité ticket (6/6 critères)**

- Deux sources distinctes → `SOURCE_APPEARED` au même timestamp : couvert par `release_events_source_events_unique` sur `(media_type, media_id, event_type, occurred_at, source_id) WHERE event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')`. Testé à la ligne 129.
- Re-sync même source = idempotent : `.onConflictDoNothing()` sans conflict target capture les violations de partial indexes en PostgreSQL. Testé ligne 148.
- Comportement équivalent pour `SOURCE_DISAPPEARED` : testé lignes 167 et 184.
- Idempotency conservée pour non-source events : couvert par le second partial index. Testé ligne 203.
- Migration correcte (`0013`) : drop de l'ancien constraint, création des deux indexes en un fichier. Additive sur données existantes (le nouvel index est plus permissif que l'ancien).
- Suite de tests dédiée `source-aware idempotency` avec 5 cas couvrant tous les scénarios demandés.

**Qualité technique**

- Schéma Drizzle et SQL de migration identiques (noms d'index, colonnes, WHERE clauses).
- Le numéro de migration est `0013` alors que le plan indiquait `0011` — des migrations sont intervenues entre-temps, c'est cohérent avec le journal.
- Scope strictement borné : aucun changement dans `catalog-sync-service.ts`, aucune modification du contrat `ReleaseEventType`.

## Observation mineure (non bloquante)

Le partial index source-aware ne déduplicale pas les lignes avec `source_id IS NULL` (comportement PostgreSQL : `NULL != NULL` dans les index uniques). En pratique le catalog-sync passe toujours un `sourceId`, et ce cas est hors scope. À noter dans un ticket de hardening futur.

## Décision

**APPROVED** — aucune correction requise.

IMPLEMENTATION_APPROVED
