---

# PR Review — T005 Implement Xtream Codes Catalog Ingestion

## Résumé

L'implémentation ajoute exclusivement le sous-arbre `apps/api/src/providers/xtream/` (4 fichiers de code + 1 suite de tests + 7 fixtures). Aucun fichier existant n'est modifié. Le périmètre respecte strictement le ticket et le plan. Les 22 tests de la suite passent avec succès.

## Vérifications effectuées

- Lecture complète de `client.ts`, `types.ts`, `errors.ts`, `index.ts`
- Lecture de `client.test.ts` et inspection des 7 fixtures
- Exécution de `pnpm --filter api test` et `pnpm --filter api typecheck`
- Vérification de l'isolation provider/domaine (imports croisés, schéma DB, routes, services)
- Vérification des chemins d'erreur : redaction des credentials, classes `instanceof`, messages

## Points validés

**Isolation provider/domaine**
Aucun type Xtream n'est importé en dehors de `providers/xtream/`. Les schémas Drizzle (`db/schema/`), les routes et les services sont intacts. Le périmètre est parfaitement borné.

**Gestion des credentials**
`sanitizeUrl()` (client.ts:17-26) redacte `username` et `password` des paramètres de requête avant toute inclusion dans un message d'erreur. Aucun `console.log` / `console.error` dans le code implémenté. Trois tests vérifient explicitement l'absence de credentials dans les messages d'erreur.

**Classes d'erreur**
`XtreamAuthError`, `XtreamNetworkError` et `XtreamParseError` sont des classes distinctes `instanceof`-catchables. Le `name` est explicitement positionné sur chacune pour contourner les limitations d'héritage d'`Error` en TypeScript. Testé.

**Robustesse réseau**
`AbortSignal.timeout()` est utilisé pour le timeout. `DOMException(TimeoutError)` → `XtreamNetworkError`. `TypeError` (host injoignable) → `XtreamNetworkError`. Validé par tests.

**Large catalog**
Fixture de 5 000 items (800 KB) chargée et parsée sans crash. Test pass en < 6 ms.

**Tests**
22 tests, tous verts, sans compte IPTV live requis. Couvrent : auth, VOD, séries, épisodes, filtrage par catégorie, JSON malformé, structure inattendue, timeout, host injoignable, catalog vide, large catalog, isolation des classes d'erreur.

**Scope**
Zéro modification de fichier existant. Zéro dépendance externe ajoutée. Zéro route ou service introduit.

## Problèmes détectés

### Mineurs (non bloquants)

**1. Tout HTTP non-2xx → `XtreamAuthError`** (client.ts:92-94)

```ts
if (!response.ok) {
  throw new XtreamAuthError(`Provider rejected request with HTTP ${response.status}`)
}
```

Un `503 Service Unavailable` ou `500 Internal Server Error` est traité identiquement à un `401 Unauthorized`. Un consumer implémentant de la logique de retry (relancer sur 503, informer l'utilisateur de vérifier ses credentials sur 401) ne peut pas distinguer les deux. Ce choix correspond au plan (trois classes d'erreur), mais la sémantique est inexacte pour les codes 5xx.

**2. `XtreamCatalogSnapshot` défini mais jamais produit** (types.ts:103-110)

Le type est exporté comme "boundary d'ingestion", mais aucune méthode du client ne le construit ni ne le retourne. De plus, son champ `series: XtreamSeries[]` contient seulement la liste superficielle — les épisodes et détails de saisons nécessitent un appel `getSeriesInfo()` par série. Le future ticket de catalog-sync devra construire son propre agrégat. Ce type, tel que défini, ne constitue pas un boundary complet pour la verticale séries.

**3. Champ `direct_source` dans `XtreamVodStream` et `XtreamEpisode`** (types.ts:35, 95)

Ce champ peut contenir une URL de stream incluant des credentials. Il est optionnel et non utilisé dans T005, mais du code futur qui sérialise ou logue ces objets (catalog-sync, debug logs) devra l'exclure explicitement. La présence du champ dans les types n'est pas documentée comme sensible.

### Pré-existant (hors scope T005)

- `src/routes/sources.test.ts:297` → erreur TS2322 `"M3U"` non assignable à `"XTREAM"` : introduite par T004, sans lien avec les fichiers T005.
- `src/db/__tests__/catalog-constraints.test.ts` → fail suite à l'absence de `DATABASE_URL` en environnement CI local : pré-existant.

## Risques éventuels

- Le risque credential dans `direct_source` est réel pour les tickets aval (catalog-sync, debug). Doit être documenté lors de l'implémentation du sync.
- La confusion 5xx/401 dans `XtreamAuthError` pourrait se manifester lors d'incidents provider — facilement corrigeable dans un ticket futur sans casser le boundary.

## Décision

- **APPROVED**

Les critères d'acceptation du ticket sont tous satisfaits. Les deux observations non bloquantes (classification HTTP et complétude du snapshot) restent dans les contraintes du plan approuvé. Aucun problème de sécurité, de régression ou de dérive de scope n'est détecté.

## Actions demandées

Aucune action bloquante. Recommandations pour les tickets suivants :

1. Lors de l'implémentation catalog-sync : documenter que `direct_source` ne doit pas être sérialisé/loggué.
2. Envisager de raffiner la classification HTTP dans un ticket dédié si la logique de retry devient nécessaire.
3. Corriger l'erreur TS2322 dans `sources.test.ts` (T004 debt).

---

IMPLEMENTATION_APPROVED
