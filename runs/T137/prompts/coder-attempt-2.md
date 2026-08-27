# GLOBAL CONTEXT

# Global Context — Iptvflix

## Project

- project_id: iptvflix
- repo: git@github.com:Billboc31/iptvflix.git

## AI Dev Factory

This project uses AI Dev Factory for AI-assisted development.

Agent context folders:
- `ai/` — roles and skills
- `docs/` — project documentation
- `prompts/` — ticket-specific and generic prompts
- `runs/` — per-ticket runtime artifacts
- `tickets/` — ticket definitions

---

# ROLE

# Role — Coder

## Mission

Implémenter strictement un ticket en suivant le plan validé et les skills applicables.

## Tu dois

- lire le ticket
- lire le plan validé
- respecter le scope
- lister les fichiers créés ou modifiés
- produire un changement minimal, lisible et testable
- ajouter ou adapter les tests si nécessaire
- signaler les hypothèses et limites

## Tu ne dois pas

- élargir le ticket
- réécrire l’architecture sans demande explicite
- faire un refactor massif non demandé
- modifier la mémoire projet sauf si le ticket le demande explicitement
- masquer les erreurs ou incertitudes

## Sortie attendue

- résumé des changements
- liste des fichiers modifiés
- vérifications effectuées
- limites connues

## Règles

- coder uniquement après `PLAN_APPROVED`
- ne jamais contourner les contraintes du plan
- garder les changements petits et reviewables

---

# SKILL: workflow-discipline

# Skill — Workflow Discipline

## Objectif

Faire respecter le lifecycle officiel des tickets et PR IA.

## Règles

- respecter l’ordre des étapes du workflow
- ne pas bypass les reviews obligatoires
- maintenir les statuts cohérents
- conserver les artefacts versionnés
- séparer plan, implémentation et mémoire

## Refuser si

- une review obligatoire est sautée
- la mémoire est mise à jour avant validation implémentation
- le workflow officiel est contourné

---

# SKILL: git-discipline

# Skill — Git Discipline

## Objectif

Maintenir un historique Git propre, compréhensible et traçable.

## Règles

- un ticket = une unité de travail cohérente
- éviter les commits mélangeant plusieurs sujets
- utiliser des messages de commit explicites
- conserver les PR lisibles
- éviter les modifications hors scope
- maintenir les fichiers mémoire cohérents avec les changements réels

## Refuser si

- la PR mélange plusieurs fonctionnalités
- des changements non liés sont ajoutés
- les commits deviennent impossibles à reviewer

---

# SKILL: code-quality

# Skill — Code Quality

## Objectif

Produire des changements simples, lisibles, robustes et faciles à reviewer.

## Règles

- privilégier le code simple avant le code sophistiqué
- utiliser des noms explicites
- garder des fonctions courtes et lisibles
- éviter la magie cachée
- gérer les erreurs explicitement
- ajouter des logs utiles sans bruit excessif
- éviter les dépendances inutiles
- conserver un changement borné au ticket

## Refuser si

- le code devient inutilement complexe
- le ticket introduit une dépendance non justifiée
- les erreurs sont masquées
- les changements dépassent le scope demandé

---

# SKILL: refactor-safety

# Skill — Refactor Safety

## Objectif

Limiter les régressions et les dérives de scope lors des modifications.

## Règles

- modifier uniquement le périmètre demandé
- éviter les refactors transversaux implicites
- préserver les comportements existants
- maintenir la compatibilité sauf demande explicite
- privilégier des changements incrémentaux

## Refuser si

- le ticket dérive vers une réécriture globale
- plusieurs couches sont modifiées sans justification
- le comportement change silencieusement

---

# SKILL: security

# Skill — Security

## Objectif

Réduire les risques de sécurité et éviter les comportements dangereux.

## Règles

- ne pas exposer de secrets dans logs ou documentation
- limiter les permissions au strict nécessaire
- éviter les exécutions implicites dangereuses
- valider les entrées externes
- documenter les impacts sécurité importants
- éviter les comportements destructifs implicites

## Refuser si

- des secrets sont hardcodés
- des données sensibles sont logguées
- une opération destructive n’est pas explicitement contrôlée

---

# TASK

# Generic Coder Task

Read the ticket and the approved plan below, then implement the required changes.

The implementation must:
- follow the approved plan strictly
- remain within scope
- list all created or modified files
- be minimal, readable, and testable

The ticket follows.


# T137 — Build universal Live TV search across canonical channels and EPG programs

**Source**: GitHub Issue #292

## Description

## Context

IPTVFlix Live now needs search to answer the user's actual intent, not only match channel names.

Examples:
- `TF1` → find the canonical channel.
- `US Open` → find channels broadcasting US Open content now and upcoming broadcasts.
- `Fort Boyard` → find the channel(s) carrying it now, or the next scheduled broadcasts with date/time.
- Natural query wording such as `je veux regarder US Open` should still resolve to the relevant program intent where feasible without introducing an LLM dependency for every search.

This search will power Android TV first but must be exposed as a reusable backend capability for other IPTVFlix clients.

## Goal

Create a unified search API/index over **canonical Live TV channels + EPG programs**, with explicit distinction between content airing now and future broadcasts.

## Search domains

### Canonical channels
Search canonical channel fields such as:
- channel name;
- normalized aliases where available;
- category/country/language where useful.

Never return raw duplicate `ChannelSource` entries as separate user-facing results.

### EPG programs
Index/search useful EPG metadata when available:
- title;
- subtitle/episode title;
- description/summary with a lower ranking weight;
- canonical channel;
- start/end timestamps.

Search must support partial/normalized matching and be resilient to accents/casing/basic punctuation differences.

## Result semantics

Return enough structured information for clients to build at least these groups:

### LIVE_NOW
A matching program is currently airing.
Return:
- canonical channel id/name/logo;
- program title;
- start/end;
- progress where cheaply derivable;
- playback eligibility / information required to start the canonical channel.

### UPCOMING
A matching program is scheduled later.
Return:
- canonical channel;
- program title;
- localizable start/end timestamps;
- stable EPG/program identifier when available.

### CHANNEL
Direct channel-name matches independent of program search.

## Ranking

Rank with user intent in mind:
1. strong exact/near-exact LIVE_NOW program matches;
2. strong canonical channel matches where query resembles a channel;
3. upcoming exact/near-exact program matches ordered by relevance and then soonest occurrence;
4. weaker description/semantic matches later.

Do not let a description containing `US Open` outrank a program actually titled `US Open`.

When multiple technical sources map to the same canonical channel/program occurrence, collapse them into one result.

## Natural query normalization

Support lightweight normalization of conversational prefixes such as:
- `je veux regarder ...`
- `mettre ...`
- `regarder ...`

Do this deterministically where possible. Do **not** require an LLM call for every search request.

## API / performance

- Expose a reusable endpoint/service suitable for Android TV remote search.
- Search must be fast enough for incremental text search; debounce remains a client concern.
- Avoid scanning/parsing raw provider playlists/EPG XML on every query.
- Use the existing persisted/cached EPG/canonical-channel data and add an appropriate search index/materialization if necessary.
- Define a bounded upcoming horizon (for example the EPG data horizon actually available) rather than returning stale historical schedules.
- No manual production DB changes; schema changes must use migrations if required.

## Edge cases

- EPG unavailable → channel search still works.
- Program exists on several canonical channels → return each meaningful broadcast/channel occurrence.
- Same program repeated later → expose useful upcoming occurrences without noisy duplicate rows.
- Program currently live and also scheduled later → LIVE_NOW result first; upcoming occurrences may also be returned.
- Timezones must remain unambiguous in API contracts; clients localize for display.

## Acceptance criteria

- [ ] One search API can return canonical channel and EPG-program matches.
- [ ] Query `US Open`-style program names can return current and upcoming broadcasts when present in EPG data.
- [ ] Querying a channel name returns the canonical channel without source duplicates.
- [ ] Results explicitly distinguish LIVE_NOW / UPCOMING / CHANNEL.
- [ ] Current broadcasts contain enough information for Android TV to start playback.
- [ ] Upcoming broadcasts contain canonical channel + date/time information.
- [ ] Exact/title matches rank above incidental description matches.
- [ ] Lightweight natural-language prefixes are normalized without per-query LLM usage.
- [ ] Search remains functional when EPG is absent or partial.
- [ ] Add tests for live matches, future matches, direct channel matches, duplicate source collapse, repeated programs, accents/case, no-EPG behavior and ranking.
- [ ] No provider/program-specific hardcoding.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All expected files are present. Implementation is complete. Here's a summary:

---

## Changes delivered

### New files
| File | Purpose |
|------|---------|
| `apps/api/migrations/0056_t137_live_search.sql` | Enables PostgreSQL `unaccent` extension for accent-insensitive channel name search |
| `apps/api/src/services/live-search-normalizer.ts` | Strips French conversational prefixes (`je veux regarder`, `regarder`, `mettre`, `voir`) deterministically |
| `apps/api/src/services/live-search-service.ts` | Core `searchLiveTV()` — queries channels via `unaccent ILIKE`, resolves EPG catalog IDs to canonical channels, collapses duplicate sources, deduplicates repeated programs, groups into `liveNow`/`upcoming`/`channels` |
| `apps/api/src/services/__tests__/live-search-service.test.ts` | 27 passing tests covering all acceptance criteria |

### Modified files
| File | Change |
|------|--------|
| `apps/api/src/services/epg-service.ts` | Exports `EpgCache` + `EpgMatch` types; adds `searchEpgPrograms()` with accent/case-insensitive title matching and `isLive`/`matchWeight` classification |
| `packages/api-contracts/src/channels.ts` | Adds `LiveNowResult`, `UpcomingResult`, `ChannelResult`, `LiveSearchResponse` types |
| `apps/api/src/routes/channels.ts` | Adds `GET /channels/search?q=` endpoint (no auth, 400 on empty/long query, normalises conversational prefixes) |
| `apps/api/vitest.config.ts` | Adds dummy `DATABASE_URL` env var so unit tests don't error on import |
| `apps/android-tv/.../ChannelModels.kt` | Adds `LiveNowResult`, `UpcomingResult`, `ChannelSearchResult`, `LiveSearchResponse` data classes |
| `apps/android-tv/.../ChannelApi.kt` | Adds `searchLiveTV(query: String): LiveSearchResponse` |

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T137/reviews/implementation-review.md
- generated at: 2026-08-27T14:03:05Z

---

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