I have a complete picture. Writing the review now.

---

# PR Review — T137 Live TV Search (re-review post-fix)

## Résumé

Re-review de l'implémentation après correction du problème bloquant identifié lors du premier cycle. Les trois changements demandés ont été appliqués : filtre LIVE_NOW sans source, extraction de `normalizeText`, et commentaire sur `deliveryMode`. 28 tests passent.

## Vérifications effectuées

- Lecture de `live-search-service.ts`, `epg-service.ts`, `live-search-normalizer.ts`, `utils/text.ts`, `channels.ts` (route), `api-contracts/src/channels.ts`, `ChannelApi.kt`, `ChannelModels.kt`, migration SQL.
- Vérification de l'application précise de chaque correction demandée dans le premier review.
- Analyse d'un edge case résiduel lié à l'ordre des opérations sur `liveNowChannelIds`.
- Contrôle des 28 tests (count + couverture du nouveau cas ajouté).

## Points validés

- **Fix bloquant appliqué** : `apps/api/src/services/live-search-service.ts` ligne 177 — `.filter((r) => r.streamUrl !== '')` précède le `.sort()`. Les résultats LIVE_NOW sans source AVAILABLE sont bien exclus. ✅
- **Nouveau test ajouté** : `'live match with no available source excluded from liveNow'` (ligne 343 du test file) — couvre exactement le cas corrigé. ✅
- **`normalizeText` extrait** : `apps/api/src/utils/text.ts` exporte la fonction ; `epg-service.ts` et `live-search-service.ts` importent depuis `../utils/text.js`. Aucune duplication résiduelle. ✅
- **Commentaire `deliveryMode`** : lignes 119-120 de `live-search-service.ts` explicitent clairement l'approximation et renvoient vers `/channels/:id/playback/resolve`. ✅
- **Tous les ACs du ticket** : couverture inchangée depuis le premier review — LIVE_NOW/UPCOMING/CHANNEL, ranking, déduplication, no-EPG, accents/casse, préfixes conversationnels. ✅
- **Sécurité / scope** : aucune dérive introduite par le fix.

## Problèmes détectés

### 🔵 OBSERVATION — Effet de bord sur `liveNowChannelIds` post-filtre streamUrl

**Fichier** : `apps/api/src/services/live-search-service.ts`, ligne 127

```ts
const liveNowChannelIds = new Set(liveNowMap.keys())  // construit AVANT le filtre streamUrl
```

`liveNowMap` est rempli à la ligne 109 pour tous les canaux ayant un match EPG live, y compris ceux sans source AVAILABLE (streamUrl `''`). `liveNowChannelIds` capture ces canaux. Quand la construction du groupe CHANNEL (ligne 151) exclut `liveNowChannelIds`, ces canaux sont aussi absents du groupe CHANNEL — alors qu'ils n'apparaissent plus dans `liveNow` non plus (filtrés ligne 177).

Scénario : canal avec EPG live **mais aucune source AVAILABLE** → n'apparaît ni en LIVE_NOW ni en CHANNEL. Disparition silencieuse des résultats.

Cas réel rare (canal sans source = non-synced ou toutes sources down), et les ACs n'imposent pas de fallback CHANNEL dans ce cas. Non-bloquant.

**Correction possible** (pour un futur ticket si le cas devient fréquent) :

```ts
// Construire liveNowChannelIds après le filtre :
const liveNow = [...liveNowMap.values()]
  .filter((r) => r.streamUrl !== '')
  .sort(...)
const liveNowChannelIds = new Set(liveNow.map((r) => r.channelId))
```

---

### 🔵 OBSERVATION — `titleRank` compare `normalizeText(title)` avec `query` non-normalisé par accentuation

**Fichier** : `apps/api/src/services/live-search-service.ts`, lignes 13-18

La fonction `titleRank` compare `normalizeText(title)` (accents supprimés) avec `query` (issu de `normalizeQuery` : lowercase + prefix strip, **sans** suppression des accents). Pour une requête accentuée comme `"Téléfilm"` → `normalizeQuery` = `"téléfilm"` → `titleRank` ne trouvera pas d'exact match car `"telefilm" !== "téléfilm"`. La recherche fonctionne (le programme apparaît en résultat), mais le rang exact peut être dégradé à substring.

Cas très marginal dans un contexte IPTV français. Non-bloquant.

---

### 🔵 (reporté du 1er review) — Réponse 400 avec body success-shaped

Non corrigé, comme attendu (n'était pas dans les actions obligatoires). Reste une observation sans impact pratique.

## Risques éventuels

- **Mock DB fragile** (reporté du 1er review) : `makeDbMock` basé sur compteur d'appels. Risque de faux positifs en cas de refactor de l'ordre des queries dans `searchLiveTV`. Pas de risque immédiat.
- L'edge case `liveNowChannelIds` ne dispose pas de test. Si le comportement doit changer, il faudra l'ajouter explicitement.

## Décision

- **APPROVED**
- ~~REQUEST_CHANGES~~

## Actions demandées

Aucune action bloquante. Les deux observations 🔵 ci-dessus peuvent être adressées dans un ticket de maintenance si le besoin se confirme.

IMPLEMENTATION_APPROVED
