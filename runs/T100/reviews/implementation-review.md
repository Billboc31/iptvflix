I now have a complete picture. Let me write the final review.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data (Review 4)

## Résumé

Quatrième passe. Les trois correctifs demandés par la review 3 sont tous en place. L'implémentation est désormais complète sur tous les axes du ticket : schéma DB enrichi, taxonomie 43 types, session service, milestones dédupliqués, taste service 11 dimensions exposées via API, backfill idempotent, rétention par classe, 5 routes admin, instrumentation Web et Android TV. Aucun bloquant résiduel.

---

## Vérifications effectuées

- `packages/api-contracts/src/taste.ts` — type `ProfileTaste` complet
- `apps/api/src/services/profile-taste-service.ts` — `buildOutput` retourne les 11 champs, `tasteVersion` issu de `.returning()`
- `apps/api/src/db/schema/profile-interaction-events.ts` — `sessionId` avec `.references(() => viewingSessions.id, { onDelete: 'set null' })`
- Migration `0041_t100_profile_interaction_events_v2.sql` — additive, IF NOT EXISTS, cascade correcte sur les 3 tables
- `interaction-event-service.ts` — `ALLOWED_EVENT_TYPES` (43 types), validation 4 KB metadata, idempotency
- `playback-milestone-service.ts` — `emitMilestoneIfNew` avec clé `profileId:mediaId:sessionId:milestone`
- `viewing-session-service.ts` — open/update/close/getActive
- `interaction-events.ts` (batch route) — best-effort, ouverture session sur PLAY_STARTED, fermeture sur PLAY_COMPLETED/ABANDONED, routage milestones
- `profile-taste-service.ts` — 11 dimensions calculées et persistées
- `retention-service.ts` — compaction ANALYTICS/STANDARD/SEARCH avec counts réels
- `admin.ts` — 5 routes
- `backfill-interaction-events.ts` — idempotent, schemaVersion=0, origin=backfill
- `PlayerPage.tsx` (web) — cycle complet PLAY_STARTED → PLAY_COMPLETED/ABANDONED, sessionId capturé
- `useProgressSync.ts` — milestones client-side dédupliqués par `emittedMilestonesRef`, envoyés via batch
- `PlayerViewModel.kt` (Android TV) — `sessionEnded` flag, `emitAbandonIfNeeded` dans `stop()` et `onCleared()` avec `NonCancellable`
- `InteractionEventService.kt` — `sessionId` extrait de la réponse batch et retourné

---

## Points validés

- **[Fix 1 résolu]** `ProfileTaste` dans `packages/api-contracts/src/taste.ts` expose maintenant `personScores`, `personMeta`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `completionRate`, `historyEventCount`, `tasteVersion` — critère de plan vérifiable via API.
- **[Fix 2 résolu]** `buildTaste` utilise `.returning({ tasteVersion: profileTaste.tasteVersion })` sur l'upsert ; `tasteVersion: upserted?.tasteVersion ?? 1` reflète l'incrément réel DB.
- **[Fix 3 résolu]** `sessionId: uuid('session_id').references(() => viewingSessions.id, { onDelete: 'set null' })` — schéma Drizzle aligné sur la migration SQL.
- **Rétention** : `WATCHED_90_PERCENT` absent de `STANDARD_TYPES` → conservé indéfiniment conformément au plan (HIGH_VALUE).
- **Milestone déduplication double couche** : client (`emittedMilestonesRef`) + serveur (`emitMilestoneIfNew`) — correct, pas de conflit.
- **Backfill** : `PLAY_COMPLETED`/`MY_LIST_ADDED`/`LIKED`/`DISLIKED` créés avec `idempotencyKey = backfill:...`, pas de timestamp inventé.
- **Android TV** : `emitBatch([PLAY_STARTED]) → sessionId` capturé, `emitAbandonIfNeeded` guarded par `sessionEnded`.
- **Web** : `emitBatch([PLAY_STARTED])` → `.then(res => sessionIdRef.current = res.sessionId)`, PLAY_ABANDONED sur unmount avec seuil 5%.

---

## Problèmes détectés

### 🟡 OBSERVATION — `admin/interaction-health` : compteur de rejets idempotency absent

**Fichier** : `apps/api/src/routes/admin.ts` (route `/admin/interaction-health`)

Le plan §15 spécifie *"duplicate event count (same idempotencyKey rejected)"*. La route retourne `milestoneCoveragePercent` et `profilesWithZeroEvents`, mais pas le nombre de rejets par idempotency. Ce compteur est structurellement impossible à mesurer sans compteur dédié : les rejets ne sont jamais insérés. Non bloquant — les deux métriques utiles (coverage milestones, profils sans events) sont présentes.

### 🟡 OBSERVATION — Mobile non documenté comme out-of-scope

Observation portée depuis la review 3, non corrigée dans ce patch (attendu — c'était mineur). `apps/mobile/` n'existe pas, `implementation-output.md` ne mentionne pas explicitement l'absence. À documenter pour clarifier le delta plan/livraison.

---

## Risques éventuels

Aucun risque résiduel bloquant. Les deux observations sont mineures et n'affectent pas la solidité de l'infrastructure de collecte.

---

## Décision

Tous les défauts bloquants de la review précédente sont corrigés. L'implémentation couvre l'ensemble du périmètre du ticket : collecte d'événements profilés, taxonomie versionnée, session de visionnage, milestones dédupliqués, taste model 11 dimensions exposées via API, rétention par classe, backfill idempotent, suppression en cascade, et diagnostics admin. Les deux observations restantes sont mineures et non bloquantes.

IMPLEMENTATION_APPROVED
