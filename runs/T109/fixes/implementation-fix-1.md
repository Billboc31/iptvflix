# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T109/reviews/implementation-review.md
- generated at: 2026-08-18T17:13:52Z

---

Now I have all the information to write a complete, structured review.

---

# PR Review — T109

## Résumé

L'implémentation se limite à des modifications de tests uniquement : deux nouveaux tests d'intégration dans `vertical-slice.test.ts`, deux nouveaux tests unitaires dans `playback-resolver.test.ts`, et des corrections de tests existants (format de réponse sync, assertion XTREAM null→mkv). Aucune modification de code de production. Le coder justifie cela par une investigation préalable confirmant que la chaîne architecture est déjà complète et fonctionnelle.

Les tests ajoutés couvrent correctement les points-clés : liaison canonique `Series → Season → Episode → episodeAvailabilities`, scoping de la progression par `(profileId, EPISODE, episodeId)`, résolution de playback via `resolvePlayback('episode', episodeId)`.

**Point bloquant** : le ticket et le plan exigent explicitement une validation E2E manuelle avec une vraie source IPTV. Cette étape est absente.

---

## Vérifications effectuées

1. **Investigation architecture** — vérifiée via exploration du code source :
   - `resolveEpisodeId()` (`catalog-sync-service.ts:366-398`) crée les lignes `episodes` avec `(seriesId, seasonId, episodeNumber)` corrects.
   - `episodeAvailabilities` ont `episodeId` pointant vers l'UUID épisode canonique.
   - La requête du catalog (`catalog.ts:418`) filtre bien par `inArray(episodeAvailabilities.episodeId, episodeIds)` — pas par seriesId.
   - Le cast `::text` est présent sur les trois jointures availability→sources (`catalog.ts:144, 280, 440`), évitant que `sourceDisplayName` soit silencieusement null.
   - `resolvePlayback('episode', episodeId)` (`playback-resolver.ts:63-80`) requête `episodeAvailabilities` par `episodeId`.
   - `EpisodeCard.tsx:96` navigue vers `/player/episode/${episode.id}` avec `availabilityId` en param.
   - `PlayerPage.tsx:111` écrit le progress sur `PUT /progress/EPISODE/:episodeId`.
   - `variant-label.ts` (présent depuis T093) ne jamais utilise l'`id` UUID dans la génération de label ; `variant-label.test.ts:106-110` vérifie explicitement l'absence d'UUID.

2. **Tests ajoutés** — deux slices dans `vertical-slice.test.ts` :
   - *Slice 1* : Sync → DB chain `series → saison → épisode` → `episodeAvailabilities` keyed by episodeId → catalog API expose `availabilityStatus/Count/variants` → `upsertProgress` stocké sur `(EPISODE, ep1Id)` → `watchState` par épisode isolé.
   - *Slice 2* : Sync → DB chain → `resolvePlayback('episode', episodeId)` retourne `DIRECT gatewayUrl` → progress persisté → second `resolvePlayback` retourne `startPositionSeconds=300`.
   - Deux tests dans `playback-resolver.test.ts` : sélection explicite de variant épisode, reprise de position depuis viewingProgress.

3. **Corrections de tests existants** :
   - Format de réponse sync (`'DONE'` → `'COMPLETED'`, `moviesAdded` → `moviesCreated`) aligné sur l'API réelle.
   - Assertion XTREAM null-extension corrigée de `'ts'` → `'mkv'` — correction légitime d'une assertion incorrecte, pas d'un comportement production.

4. **Cleanup test** — `afterEach` correctement étendu pour nettoyer `episodeAvailabilities`, `titleMatchResults`, profiles, et le pattern `waitForSyncRunId` est robuste (polling 100ms avec timeout 15s).

---

## Points validés

- ✅ Architecture complète et correcte end-to-end (chain vérifiée par lecture du code)
- ✅ `episodeAvailabilities.episodeId` pointe sur l'UUID épisode canonique, pas sur le seriesId
- ✅ Resolver query scoped sur episodeId, pas seriesId
- ✅ Labels variants sans UUID (variant-label.ts + test no-UUID)
- ✅ Progress isolé par `(profileId, EPISODE, episodeId)`
- ✅ `PlayerPage` écrit sur `PUT /progress/EPISODE/:episodeId`
- ✅ Scope respecté — pas de refactor transversal, pas de dérive
- ✅ Sécurité : credentials non loggués (tests `secret redaction` existants), pas de secrets hardcodés
- ✅ Nettoyage test complet dans `afterEach`
- ✅ `variant-label.test.ts` pré-existant depuis T093 satisfait l'exigence du plan

---

## Problèmes détectés

### 🔴 BLOQUANT — Validation E2E manuelle absente

Le ticket stipule explicitement :

> "This issue is **not complete merely because unit tests pass**. Validate manually/end-to-end with at least one real imported series that has multiple episodes and real IPTV availability."

Le plan liste 8 checklist items comme condition de complétion bloquante, dont : playback réel, persistance de progression, reprise depuis position sauvegardée, épisode indisponible représenté correctement. L'`implementation-output.md` ne mentionne aucune validation manuelle. Cette étape requiert une intervention humaine (accès au serveur de dev, source IPTV réelle, navigateur).

**Action requise** : Un développeur humain doit parcourir le checklist E2E du ticket avec une vraie source IPTV avant de considérer le ticket comme terminé. Le code lui-même est architecturalement correct — la validation permettra de confirmer l'intégration bout-en-bout.

---

### 🟡 MINEUR — `cleanupProfileId` partagé entre deux tests episodes

Deux tests dans `vertical-slice.test.ts` (lignes 372 et 564) créent un profil et assignent `cleanupProfileId`. Si la séquence de test échoue entre les deux affectations dans un même run (edge case), un profil pourrait ne pas être nettoyé. En pratique les tests Vitest sont séquentiels et `afterEach` s'exécute entre chaque test — pas de risque réel, mais c'est un point à noter pour la lisibilité.

### 🟡 MINEUR — Nommage incohérent des deux slices épisode

Les deux tests utilisent des séparateurs différents dans leur nom : `'episode slice — catalog API...'` (tiret em) vs `'episode slice: sync creates...'` (deux-points). Mineure, cosmétique.

### 🟡 MINEUR — `viewingProgress` orphelins potentiels après cleanup profile

L'`afterEach` supprime le profil mais pas directement les lignes `viewingProgress` associées. Si la FK `profileId` sur `viewingProgress` n'a pas `ON DELETE CASCADE`, des lignes orphelines s'accumulent dans la base de test. À vérifier dans le schéma.

---

## Risques éventuels

- Le test Slice 1 asserte `ep1Avails[0]?.providerItemId === '8001'` — si le sync crée l'épisode 1 avec un autre providerItemId selon l'ordre de traitement, le test pourrait être flaky. La fixture retourne les épisodes dans l'ordre `[{ id: '8001', episode_num: 1 }, { id: '8002', episode_num: 2 }]` donc c'est stable en l'état, mais sensible à un changement de fixture.
- `XTREAM_FETCH_SERIES_INFO=true` est setté globalement dans `beforeAll`. Si d'autres tests dans la suite (pas dans ce fichier) dépendent de l'absence de cette variable, il pourrait y avoir une pollution d'environnement. Ce flag est cependant nettoyé dans `afterAll`.

---

## Décision

Le code de production est architecturalement sain et les tests ajoutés sont de bonne qualité. Cependant, l'acceptation explicite du ticket requiert une validation E2E humaine avec une vraie source IPTV — critère non rempli. Cette étape ne peut pas être substituée par des tests automatisés selon les termes du ticket lui-même.

IMPLEMENTATION_FIX_REQUIRED
