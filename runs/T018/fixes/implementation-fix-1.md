# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T018/reviews/implementation-review.md
- generated at: 2026-08-12T05:44:09Z

---

---

# PR Review — T018: Profile playback preferences + deterministic best-availability selection

## Résumé

L'implémentation couvre l'essentiel du ticket avec une qualité correcte. Le resolver déterministe est bien conçu, les tests unitaires sont complets, et l'intégration dans les routes catalogue est propre. Deux problèmes bloquants ont été identifiés.

## Points validés

- **Schéma / migration** : 4 colonnes ajoutées correctement avec defaults SQL appropriés
- **Resolver** `availability-resolver.ts` : algorithme 5-tuple (audio → subtitle → source → quality-capped → id) correct, cap qualité via `Math.min(rank, cap)`, null audio inclus comme fallback (non exclu), tiebreak lexicographique. 16 tests unitaires couvrent tous les cas du plan
- **Contrats API** : `status` + `providerId` sur `AvailabilityVariantResponse`, `selectedVariantId` sur les 3 types de réponse détail, nouveaux types profil
- **Routes profil** : `GET /profile` et `PATCH /profile/preferences` avec validation input, enregistrés dans `index.ts`
- **Intégration catalog** : les 3 routes détail (`/movies/:id`, `/series/:id`, episodes) chargent les préférences une fois et retournent `selectedVariantId`
- **Frontend** : `ProfileSettingsPage` n'utilise pas `navigator.language`, UI variante selector correct, navigation en place

## Problèmes détectés

### [BLOQUANT 1] Test `ProfileSettingsPage.test.tsx` manquant

Le plan §7 exige explicitement ce fichier (trois cas de test). Il n'existe pas, alors que l'infrastructure MSW est en place (`MovieDetailPage.test.tsx`, etc.). Le critère d'acceptance #9 ("page de préférences indépendante de `navigator.language`") est non vérifiable automatiquement.

**Correction** : créer `apps/web/src/pages/ProfileSettingsPage.test.tsx` avec les cas du plan.

---

### [BLOQUANT 2] Régression UUID validation dans `catalog.ts`

Les anciennes routes dans `movies.ts`/`series.ts` validaient le format UUID avant la requête DB (→ 404 pour non-UUID). Les nouvelles routes dans `catalog.ts` n'ont pas cette validation. En production, un id non-UUID comme `"nonexistent"` provoque une erreur Postgres → **500 au lieu de 404**. Les tests mockent le DB et ne détectent pas la régression (le test `GET /movies/nonexistent` → 404 passe grâce au mock).

**Correction** : ajouter `UUID_RE` check dans `GET /movies/:id` et `GET /series/:id` de `catalog.ts`, + test sans mock pour ce cas.

---

### [Mineurs]

- **QUALITY_ORDER tripliqué** — plan demandait de supprimer les doublons de `catalog.ts` et `catalog-service.ts`, mais les deux restent. Triplication maintenant (resolver + catalog.ts + catalog-service.ts). Acceptable si reporté dans un ticket refactoring.
- **Deux maps épisodes redondantes** — `epVariantMap` et `epRawVariantMap` stockent les mêmes objets, une seule suffirait.
- **`resolveReason` inaccuracy** — `'fallback_quality'` retourné si le gagnant a une qualité, même si victoire par tiebreak. N'affecte pas la sélection.

## Décision

IMPLEMENTATION_FIX_REQUIRED
