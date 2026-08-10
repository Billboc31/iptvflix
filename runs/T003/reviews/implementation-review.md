# PR Review — T003: Define canonical media catalog domain

## Résumé

L'implémentation est correcte, bornée et satisfait tous les critères d'acceptation du ticket. Aucun problème bloquant détecté.

---

## Vérifications effectuées

- Schémas Drizzle : `genres.ts`, `movies.ts`, `series.ts`, `seasons.ts`, `episodes.ts`, `availabilities.ts`, `index.ts`
- Migration `0001_sweet_stingray.sql` et journal `_journal.json`
- Test `catalog-constraints.test.ts` (6 tests)
- Confrontation avec les 7 AC du ticket et le plan

---

## Points validés

| # | Critère | Statut |
|---|---|---|
| AC1 | Movies, series, seasons, episodes avec représentations canoniques | ✓ Tables présentes, PKs UUID `defaultRandom()` |
| AC2 | Identifiants provider via availabilities, pas en PK canonique | ✓ `provider_id`/`provider_item_id` uniquement dans `availabilities.ts` |
| AC3 | `firstSeenAt`/`lastSeenAt` séparés sans perte au resync | ✓ Champs `NOT NULL` sans `defaultNow()` ; test 4 vérifie la préservation |
| AC4 | Un item canonique sur plusieurs sources | ✓ UNIQUE triplet permet plusieurs `providerId` distincts ; test 5 |
| AC5 | Contraintes DB sur les doublons | ✓ UNIQUE sur triplets availability + `(seriesId, seasonNumber)` + `(seasonId, episodeNumber)` |
| AC6 | Migration et tests représentatifs | ✓ Migration propre, 6 tests d'intégration sur DB réelle |
| AC7 | Aucun DTO Xtream/M3U dans le domaine | ✓ Aucun champ ou import ne référence Xtream ou M3U |

---

## Observations mineures (non bloquantes)

1. **`updatedAt` non auto-géré** — Pas de trigger DB, responsabilité applicative. Documenté dans le plan. Risque de timestamps stale sans endpoint UPDATE existant pour l'instant.
2. **Junctions `movie_genres`/`series_genres` non testées** — Le `genreId` est créé dans `beforeAll` mais inutilisé dans les 6 tests. Les contraintes PK composite existent en DB mais ne sont pas vérifiées par un test. Non requis par le plan.
3. **Pas de `series_availabilities`** — Justifié comme "first vertical slice" dans le plan. Non bloquant.

---

## Décision

Implémentation approuvée. Périmètre respecté, contraintes correctes, migration propre, tests représentatifs couvrant les invariants critiques du ticket.

IMPLEMENTATION_APPROVED
