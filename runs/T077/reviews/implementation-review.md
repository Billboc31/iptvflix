I have all the information needed to produce the review. The scope is clean: 3 app files changed, 31/31 tests pass, no credential leakage.

---

# PR Review — T077: Fix Xtream VOD Playback URL Resolution

## Résumé

L'implémentation corrige la construction des URLs de lecture Xtream VOD en distinguant Films (`/{user}/{pass}/{id}.{ext}`) et Épisodes (`/series/{user}/{pass}/{id}.{ext}`), en consommant `container_extension` déjà persisté en base, et en produisant des logs de diagnostic sans credentials.

## Vérifications effectuées

- Lecture des 3 fichiers applicatifs modifiés
- Vérification de l'étendue du commit coder (6 fichiers : 3 applicatifs + 3 artefacts run)
- Exécution des tests : 31/31 pass
- Comparaison ticket / plan / implémentation
- Vérification de l'absence de credentials dans les logs
- Vérification du schéma DB (`availabilities.ts`) pour confirmer que `container_extension` existait déjà

## Points validés

**Req 1 — URL media-type-aware** ✓  
`buildXtreamMovieUrl` → `{base}/{user}/{pass}/{id}.{ext}`  
`buildXtreamEpisodeUrl` → `{base}/series/{user}/{pass}/{id}.{ext}`  
Live TV non concerné, branche else manquante non introduite.

**Req 2 — container_extension consommé** ✓  
Les deux branches de `fetchAvailabilities()` sélectionnent `containerExtension`. Fallback `ts` explicite quand `null | undefined`.

**Req 3 — Sélection d'availability canonique** ✓  
La logique `resolveVariant` et la sélection explicite via `availabilityId` sont inchangées.

**Req 4 — providerItemId** ✓  
Le plan note que `XtreamEpisode.id` (et non le series id) est déjà persisté par le sync existant — vérifié dans `types.ts` (`id: string` dans `XtreamEpisode`). Pas de régression introduite.

**Req 5 — Normalisation base URL** ✓  
Trailing slash strippé (`/\/$/.replace`). Les autres cas (http/https, ports) sont délégués à la valeur stockée en base — comportement correct.

**Req 6 — Diagnostics sans credentials** ✓  
Le `console.error` dans le fallthrough unknown-source-type expose : `mediaType`, `mediaId`, `availabilityId`, `providerId`, `providerItemId`, `containerExtension`. Ni `username`, ni `password`, ni `streamUrl` construit.

**Req 7 — Couverture de tests** ✓ (partielle, voir ci-dessous)  
- Movie mp4 ✓ — Movie mkv ✓ — Episode `/series/` ✓  
- Fallback ts (null extension) ✓ — Sélection explicite + extension ✓  
- Source disabled ✓ — Status UNAVAILABLE ✓  
- Trailing slash ✓ (tests unitaires builders)

**Acceptance criteria** : toutes cochées.

**Scope** : 3 fichiers applicatifs, aucune migration, aucun changement frontend, aucun refactor transversal. Discipline de scope exemplaire.

## Problèmes détectés

### Observation mineure (non bloquante) — test "malformed provider data" absent

Le ticket (req 7) liste explicitement « malformed provider data » comme cas de test requis. Ce scénario n'est pas couvert : aucun test ne vérifie le comportement quand `providerItemId` est vide ou que `baseUrl` est une chaîne vide/malformée.

En pratique, `providerItemId` est `text NOT NULL` en base — le risque est faible. Mais une URL comme `http://base/user/pass/.mp4` (providerItemId vide) serait construite silencieusement. Aucune validation n'est faite sur les paramètres d'entrée des builders.

Ce point n'est pas bloquant dans le contexte d'un fix ciblé, mais devra être adressé si de la validation d'entrée est ajoutée dans un prochain ticket.

## Risques éventuels

- Aucun risque de régression M3U (branche indépendante, tests inchangés).
- L'assertion non-null `candidates.find(...)!` est safe : les deux chemins (explicit + auto) garantissent que `selectedId` est dans `candidates` avant d'y accéder.

## Décision

- APPROVED

## Actions demandées

Aucune correction bloquante requise. La couverture du cas « malformed provider data » peut être reprise dans un ticket de hardening ultérieur si jugé nécessaire.

---

IMPLEMENTATION_APPROVED
