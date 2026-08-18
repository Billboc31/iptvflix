# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T109/reviews/implementation-review.md
- generated at: 2026-08-18T17:26:52Z

---

Now I have all the information needed to write the review. Let me produce it.

---

# PR Review — T109 (Attempt 3)

## Résumé

Troisième review. L'implémentation est exclusivement constituée de changements de tests — aucune modification de code de production. Par rapport aux reviews précédentes, un nouveau bug de test a été introduit dans le dernier commit (`not_started` vs `unwatched`), ce qui empêche la suite de passer. Ce point doit être corrigé avant toute nouvelle validation. Le bloquant E2E humain reste ouvert.

---

## Vérifications effectuées

### Fichiers de production modifiés

Aucun. Les deux seuls fichiers applicatifs modifiés sont :

- `apps/api/src/__tests__/integration/vertical-slice.test.ts`
- `apps/api/src/services/__tests__/playback-resolver.test.ts`

### Nouveaux points par rapport à review 2

| Point | Statut |
|---|---|
| Bug `'not_started'` vs `'unwatched'` (ligne 516 de `vertical-slice.test.ts`) | 🔴 **Nouveau bloquant** |
| Validation E2E manuelle | ❌ Toujours absente — requiert intervention humaine |

---

## Points validés

- ✅ Architecture `Series → Season → Episode → episodeAvailabilities → playback resolver` inchangée et correcte
- ✅ Deux slices d'intégration verticale bien structurées
- ✅ Tests `playback-resolver.test.ts` : lookup par `episodeId`, sélection de variante avec plusieurs availabilities, `startPositionSeconds`
- ✅ `variant-label.test.ts` : aucun UUID nu dans les labels quand `sourceDisplayName` est disponible
- ✅ Cleanup `afterEach` couvre `episodeAvailabilities`, `titleMatchResults`, profiles
- ✅ Scope strict — aucune dérive hors périmètre T109
- ✅ Sécurité : pas de secrets hardcodés, credentials non loggués

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — Test assertion incorrecte (régression introduite par le dernier commit)

**Fichier :** `apps/api/src/__tests__/integration/vertical-slice.test.ts`, ligne 516

```ts
expect(ep2WithProfile?.watchState).toBe('not_started')
```

**Problème :** `'not_started'` n'est pas une valeur retournée par l'API. La fonction `computeWatchState` dans `catalog.ts:69-73` retourne uniquement `'unwatched' | 'in_progress' | 'watched' | null`. Cette assertion fait échouer le test. Les tests existants dans `catalog.test.ts` utilisent correctement `'unwatched'`.

**Correction requise :**

```ts
// Ligne 516
expect(ep2WithProfile?.watchState).toBe('unwatched')
```

**Introduit dans :** commit `0cad8fd8` (`feat(T109/dashboard,workflow): coder — update 3 file(s)`).

---

### 🔴 BLOQUANT 2 — Validation E2E manuelle toujours absente (inchangé depuis review 1)

Le ticket stipule explicitement :

> "This issue is **not complete merely because unit tests pass**. Validate manually/end-to-end with at least one real imported series that has multiple episodes and real IPTV availability."

Les 8 critères d'acceptation listés dans le plan ne peuvent pas être validés par un agent IA. **Escalation humaine requise.**

---

## Risques éventuels

- `XTREAM_FETCH_SERIES_INFO=true` setté dans `beforeAll`, nettoyé dans `afterAll` — pas de pollution si `afterAll` s'exécute.
- Assertion `providerItemId === '6001'` dans le second slice — stable avec la fixture actuelle, sensible à un changement d'ordre.

---

## Décision

Deux bloquants subsistent :
1. Bug de test (`'not_started'`) à corriger — une ligne, modification triviale.
2. E2E humain — ne peut pas être résolu par un cycle IA supplémentaire.

Le point 1 doit être corrigé avant que le ticket puisse avancer. Le point 2 requiert une action humaine.

IMPLEMENTATION_FIX_REQUIRED
