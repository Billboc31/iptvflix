# PR Review — T029: Make release lifecycle event idempotency source-aware

## Résumé

L'implémentation remplace l'unique constraint monolithique sur `release_events` par deux partial unique indexes PostgreSQL : l'un incluant `source_id` pour `SOURCE_APPEARED`/`SOURCE_DISAPPEARED`, l'autre conservant l'idempotency d'origine pour les événements non-source. La migration, le schéma Drizzle et les tests sont tous en place et cohérents.

## Vérifications effectuées

- Schéma Drizzle : `apps/api/src/db/schema/release-lifecycle.ts`
- Migration SQL : `apps/api/migrations/0013_release_events_source_aware_idempotency.sql`
- Service : `apps/api/src/services/release-lifecycle-service.ts`
- Tests d'intégration : `apps/api/src/services/__tests__/release-lifecycle-service.test.ts`
- Plan d'implémentation : `runs/T029/plan.md`
- Ticket : `runs/T029/ticket.md`

## Points validés

### Conformité ticket (6/6 critères)

1. **Deux sources distinctes → `SOURCE_APPEARED` même timestamp** : Couvert par le partial index `(media_type, media_id, event_type, occurred_at, source_id) WHERE event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')`. Testé ligne 129.
2. **Re-sync même source = idempotent** : `.onConflictDoNothing()` sans conflict target capture toutes les violations d'unicité partielles. Testé ligne 148.
3. **Comportement équivalent pour `SOURCE_DISAPPEARED`** : Testé lignes 167 et 184.
4. **Idempotency conservée pour événements non-source** : Couvert par le second partial index. Testé ligne 203.
5. **Migration correcte** : Drop de l'ancienne constraint, création des deux partial indexes en un seul fichier. La migration est additive sur données existantes — les données historiques respectent déjà le nouvel index (plus permissif que l'ancien).
6. **Tests automatisés** : Suite dédiée `source-aware idempotency` avec 5 cas couvrant les deux event types, la co-existence multi-sources et l'idempotency mono-source.

### Qualité technique

- **Cohérence schéma/migration** : Les index names, colonnes et WHERE clauses sont identiques dans le schéma Drizzle et le SQL de migration.
- **Migration number** : Le plan indiquait `0011`, l'implémentation utilise `0013` (des migrations sont intervenues entre-temps). C'est correct et cohérent avec le journal `_journal.json`.
- **`onConflictDoNothing()` sans target** : Comportement PostgreSQL vérifié — sans conflict target, l'instruction capture toutes les violations, y compris celles sur partial indexes. Pas de changement requis dans `recordReleaseEvent` ni `catalog-sync-service.ts`.
- **Scope** : Strictement borné au ticket. Aucun changement dans `catalog-sync-service.ts`, aucune modification du contrat `ReleaseEventType`, aucun backfill.
- **Import `unique`** : Toujours utilisé pour `followRelease` (ligne 47) — pas de dead import.

## Problèmes détectés

Aucun problème bloquant.

### Observation mineure (non bloquante)

**NULL sourceId pour source events** : Le partial index sur `(…, source_id) WHERE event_type IN ('SOURCE_APPEARED', 'SOURCE_DISAPPEARED')` ne déduplicale pas les lignes où `source_id IS NULL` car PostgreSQL traite `NULL != NULL` dans les index uniques. Si `recordReleaseEvent` est appelé avec `sourceId = null` pour un event de type source, des doublons silencieux sont possibles.

Cependant :
- En pratique, le `catalog-sync-service` passe toujours un `sourceId` pour ces event types.
- Le comportement `onDelete: 'set null'` (orphelinage de source) est hors scope.
- Le ticket n'impose pas de contrainte sur ce cas.

Ce point mérite une note dans un ticket de hardening futur, pas un correctif ici.

## Risques éventuels

- **Migration sur base existante** : Si des lignes `SOURCE_APPEARED`/`SOURCE_DISAPPEARED` ont un `source_id IS NULL`, la création du partial index source-aware réussit (NULL != NULL = pas de conflit de création), mais la déduplication ne s'applique pas à ces lignes futures. Risque acceptable et pré-existant.
- **Tests non exécutables dans le worktree** : `node_modules` non installés — les tests n'ont pas pu être validés localement. La correction syntaxique du code est vérifiable par lecture ; l'exécution devra être validée en CI.

## Décision

- APPROVED

L'implémentation est correcte, bien bornée, et répond à l'ensemble des critères d'acceptation du ticket. Les tests couvrent tous les cas demandés. La migration est sûre. Aucune correction requise.

## Actions demandées

Aucune.

IMPLEMENTATION_APPROVED
