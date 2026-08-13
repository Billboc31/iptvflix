# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T049/reviews/implementation-review.md
- generated at: 2026-08-13T00:31:47Z

---

---

# PR Review — T049: M3U Catalog Ingestion

## Résumé

L'implémentation est globalement solide (architecture conforme à la frontière provider-indépendante, sécurité credentials correcte, tests unitaires complets), mais deux écarts bloquants par rapport au plan sont identifiés.

## Points validés

- **Architecture** : `M3UClient → M3UCatalogSnapshot → syncM3UCatalog → syncNormalized` respecte strictement la frontière provider-indépendante ; aucune donnée M3U dans le domaine canonique.
- **Parsing** (`parser.ts`) : validation header `#EXTM3U`, extraction des attributs par regex, rawTitle extrait de la queue comma, pairs orphelines silencieusement ignorées.
- **Classification conservatrice** : `movie|film|vod` sans `SxxExx` → movie ; `series|show|episode` ET `SxxExx` → episode ; tout le reste → unclassified non persisté. Live TV et entrées ambiguës ne créent aucune donnée canonique.
- **Idempotence** : les contraintes unique `(providerId, providerItemId)` de `syncNormalized` garantissent le comportement re-sync. Les series sont dédupliquées par `seriesKey`.
- **Cohérence IDs** : `seriesMap.key` === `NormalizedSeriesItem.providerItemId` === `NormalizedEpisodeItem.seriesProviderItemId` — liaison stable.
- **Sécurité credentials** : substitution `{username}/{password}` à la construction, `sanitizeUrl()` rédige les params sensibles, credentials jamais dans les messages d'erreur (vérifié par 4 tests dédiés).
- **Tous les 594 tests passent.**

## Problèmes bloquants

### #1 — `e2e/fixtures/m3u-server.ts` absent

Le plan liste ce fichier comme nouvelle livraison (modes `happy`, `auth-fail`, `empty`, `malformed`). Le répertoire `e2e/fixtures/` ne contient que `index.ts` et `xtream-server.ts`. Aucun test e2e M3U n'existe, donc les acceptance criteria suivants ne sont pas couverts au niveau intégration : sync COMPLETED avec `moviesCreated > 0`, idempotence, body non-M3U → run FAILED.

### #2 — Erreurs de fetch M3U ne produisent pas de run record FAILED

Le plan AC est explicite : _"Fetching a URL that returns non-M3U content does not crash the sync run; the run record ends with status FAILED and a sanitized error message."_

Chemin actuel : `fetchM3USnapshot` → `M3UClient.fetchSnapshot` → `parseM3U` lève `M3UParseError` → propagée sans être interceptée dans `triggerSync` → Fastify retourne HTTP 500 brut, aucune trace en base. `syncNormalized` (qui crée le run record et gère FAILED) n'est jamais atteinte. Même comportement pour `M3UNetworkError` et `M3UAuthError`.

**Correction recommandée** : dans `triggerSync`, encapsuler `fetchM3USnapshot` dans un try/catch qui crée un run record `FAILED` avec message sanitisé avant de retourner.

## Risques mineurs

- Double timeout possible dans `testConnection()` (range + fallback = jusqu'à 2 × 60 s).
- Attributs variants de série extraits du premier épisode rencontré seulement.
- `testConnection` dans `source-service.ts` ignore `M3U_FETCH_TIMEOUT_MS` (timeout hardcodé à 60 s par défaut).

## Actions demandées

1. Créer `e2e/fixtures/m3u-server.ts` et au moins un test e2e couvrant sync COMPLETED + idempotence.
2. Corriger `triggerSync` pour que les erreurs de fetch M3U créent un run record `FAILED` en base.

IMPLEMENTATION_FIX_REQUIRED
