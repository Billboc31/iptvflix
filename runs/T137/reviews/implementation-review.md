---

# PR Review — T137 Live TV Search

## Résumé

Implémentation d'un endpoint `GET /channels/search?q=` unifié couvrant canaux canoniques (PostgreSQL + `unaccent`) et programmes EPG (cache mémoire). Résultats groupés en `LIVE_NOW`, `UPCOMING`, `CHANNEL` avec ranking et déduplication. Client Android TV enrichi avec les types et `searchLiveTV()`. 27 tests couvrant les scénarios du ticket.

## Vérifications effectuées

- Lecture de tous les fichiers nouveaux et modifiés : migration, normalizer, epg-service, live-search-service, channels route, api-contracts, ChannelApi/ChannelModels (Kotlin), vitest.config.
- Vérification du schéma `channels` et `channelSources` (colonnes disponibles).
- Lecture de `channel-playback-resolver.ts` pour évaluer la faisabilité du `deliveryMode` dynamique.
- Analyse des 27 tests : couverture des ACs, robustesse des mocks.
- Vérification de la cohérence plan ↔ implémentation ↔ ACs du ticket.

## Points validés

- **Normalisation conversationnelle** : regex ancré `^` avec flag `/i`, appliquée après `toLowerCase()`. Les 7 tests du normalizer couvrent tous les cas documentés (`je veux regarder`, `mettre`, `regarder`, `voir`), y compris l'absence de strip en milieu de phrase.
- **Structure des résultats** : `liveNow / upcoming / channels` conforme au contrat de type dans `api-contracts`. Déduplication correcte : sources multiples → un seul résultat LIVE_NOW (priorité décroissante) ; programmes répétés → au plus 3 occurrences soonest.
- **EPG absent** : `searchEpgPrograms` renvoie `[]` si `cache == null` ou cache vide. Route `/channels/search` passe `await ensureEpgLoaded()` qui peut retourner `null`, et le service gère ce cas sans erreur.
- **Ranking** : `matchWeight 0/1/2` (exact/prefix/substring) bien propagé depuis EPG ; canal DB avec rang 0/1/2 sur `canonicalName`. Tri `liveNow` final par rang title ✅.
- **Migration** : `CREATE EXTENSION IF NOT EXISTS unaccent` idempotent ✅.
- **Scope** : aucune dérive — pas de pagination, pas de LLM, pas de changement VOD search, EPG reste en mémoire.
- **Sécurité** : pas de secrets hardcodés, pas d'injection SQL (paramètres passés via Drizzle), `q` plafonné à 100 chars, accès non authentifié cohérent avec les endpoints channels existants.
- **Android TV** : `@Serializable` + `ignoreUnknownKeys = true`, `URLEncoder.encode` correct.

## Problèmes détectés

### 🔴 BLOQUANT — `streamUrl: ''` dans les résultats LIVE_NOW

**Fichier** : `apps/api/src/services/live-search-service.ts:123`

```ts
streamUrl: sourceByChannelId.get(channel.id) ?? '',
```

Quand un canal a un match EPG live mais aucune source `AVAILABLE` en base, `sourceByChannelId.get(channel.id)` retourne `undefined` → `streamUrl` devient `''`. Le résultat est quand même ajouté à `liveNow`. Un LIVE_NOW avec `streamUrl: ''` ne peut pas être lu par Android TV.

**Violation directe de l'AC** : *"Current broadcasts contain enough information for Android TV to start playback."*

**Correction attendue** dans `live-search-service.ts` à la ligne de construction du tableau final :

```ts
// ligne ~180, remplacer :
const liveNow = [...liveNowMap.values()].sort(...)

// par :
const liveNow = [...liveNowMap.values()]
  .filter((r) => r.streamUrl !== '')
  .sort((a, b) => titleRank(a.programTitle, query) - titleRank(b.programTitle, query))
```

---

### 🟡 NOTABLE — `deliveryMode` hardcodé à `'DIRECT'`

**Fichier** : `apps/api/src/services/live-search-service.ts:125`

Le plan prévoyait de récupérer le `deliveryMode` depuis `channel-playback-resolver`. L'implémentation hardcode `'DIRECT'`. La lecture de `resolveChannelPlayback` confirme que cela impliquerait un probe réseau + session HLS par canal — incompatible avec une recherche typeahead.

Le tradeoff est pragmatiquement défendable (les canaux `.m3u8` sont `DIRECT` ; pour les autres, `channelId` est présent pour que le client appelle `/channels/:id/playback/resolve` avant de jouer). Mais ce n'est **pas documenté** dans le plan ni dans le code, et le type `LiveNowResult` laisse entendre que `deliveryMode` est fiable.

**Non-bloquant** si les canaux `.ts` / `.mkv` ne constituent pas la majorité du parc. À documenter ou à accepter explicitement.

---

### 🟡 NOTABLE — EPG title-only, pas de subtitle/description

**Fichier** : `apps/api/src/services/epg-service.ts:197-233`

Le plan spécifiait : *"Match on title (primary weight) then subtitle/description (lower weight)"*. L'implémentation ne parse que `<title>` dans le XMLTV (regex ligne 72), et `searchEpgPrograms` ne teste que `p.title`. `ParsedProgram` n'a pas de champ `subtitle` ni `description`.

Cela limite la recherche à des cas où le titre correspond exactement. Pour `"US Open"` dans un titre `"Grand Chelem : US Open"`, le substring match fonctionne. Mais un programme dont seule la description mentionne `"US Open"` ne sera pas trouvé.

**Non-bloquant** par rapport aux ACs (centrés sur le titre), mais régression par rapport au plan.

---

### 🟡 NOTABLE — `normalizeText` dupliquée

**Fichiers** : `epg-service.ts:24` et `live-search-service.ts:12`

Fonction identique dans deux fichiers. Candidat à extraction dans un utilitaire partagé, mais sans conséquence sur la correction.

---

### 🔵 MINEUR — Réponse 400 avec body success-shaped

**Fichier** : `apps/api/src/routes/channels.ts:232-236`

```ts
return reply.status(400).send({ liveNow: [], upcoming: [], channels: [] } as LiveSearchResponse)
```

HTTP 400 mais body identique à une réponse vide valide. Le client Android TV ne peut pas distinguer "aucun résultat" de "requête invalide". Sans conséquence pratique si le client ne loggue pas les erreurs, mais contraire aux bonnes pratiques API.

---

### 🔵 MINEUR — Absence de filtre catégories dans la DB query

Le plan mentionnait `categories JSONB array contains the term`. La query DB ne recherche que sur `canonicalName` et `normalizedName`. Les ACs ne l'exigent pas explicitement ; acceptable.

## Risques éventuels

- **Mock DB fragile** (`makeDbMock` dans les tests) : basé sur un compteur d'appels `selectCallIndex`. Si l'ordre des requêtes dans `searchLiveTV` change, les tests renverront de mauvais données sans échouer explicitement. Risque de faux positifs en cas de refactor futur.
- **Horizon EPG** : le plan spécifie de ne pas retourner de programmes stale. L'implémentation filtre correctement les `endTime <= now`. Mais l'horizon max (le dernier `endTime` du cache) n'est pas explicitement borné — si le cache EPG contient des données très éloignées dans le futur, elles seront retournées. Comportement probablement souhaitable mais non testé.

## Décision

- ~~APPROVED~~
- **REQUEST_CHANGES**

## Actions demandées

**Obligatoire (bloquant) :**

1. `apps/api/src/services/live-search-service.ts` — Filtrer les résultats LIVE_NOW avec `streamUrl === ''` avant de les inclure dans le tableau `liveNow` retourné. Les canaux sans source AVAILABLE ne doivent pas apparaître en LIVE_NOW.

**Recommandé (non-bloquant) :**

2. Ajouter un commentaire dans `live-search-service.ts` explicitant que `deliveryMode: 'DIRECT'` est une approximation et que le client doit appeler `/channels/:id/playback/resolve` pour une résolution correcte avant lecture.
3. Extraire `normalizeText` dans un utilitaire partagé (ex. `utils/text.ts`) pour éviter la duplication.

IMPLEMENTATION_FIX_REQUIRED
