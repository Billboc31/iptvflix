# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T100/reviews/implementation-review.md
- generated at: 2026-08-18T11:55:42Z

---

I have all the information needed. Writing the review now.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

L'implémentation couvre l'essentiel du ticket : schéma DB enrichi, taxonomie complète (~50 types), service de session, taste service étendu, backfill idempotent, admin routes, instrumentation Web et Android TV. La qualité globale est bonne. Deux défauts bloquants ont été identifiés sur la déduplication des milestones, et trois observations mineures.

---

## Vérifications effectuées

- Migration SQL `0039_t100_profile_interaction_events_v2.sql` lue intégralement
- Services lus : `interaction-event-service`, `viewing-session-service`, `playback-milestone-service`, `profile-taste-service`, `retention-service`
- Routes lues : `interaction-events.ts`, `admin.ts`
- Clients lus : `PlayerPage.tsx`, `useInteractionEvents.ts`, `useProgressSync.ts`
- Script de backfill lu intégralement
- Arborescence `apps/` vérifiée pour la présence du client mobile

---

## Points validés

- **Schéma DB** : tous les colonnes prévus au plan sont présents (`seriesId`, `seasonId`, `progressPercent`, `idempotencyKey`, `schemaVersion`, etc.) ; contrainte unique conditionnelle sur `idempotencyKey` correcte.
- **Migration** : additive, `IF NOT EXISTS` sur chaque ALTER, cascade DELETE sur `profileId` dans `viewing_sessions`, `ON DELETE SET NULL` sur `sessionId` dans `profile_interaction_events` — correct.
- **Taxonomie** : 50 types définis et validés côté serveur via `ALLOWED_EVENT_TYPES`; inconnus rejetés en 400.
- **Batch endpoint** : best-effort, jamais de 5xx pour analytics, session ouverte sur `PLAY_STARTED` et retourne `sessionId`, session fermée sur `PLAY_COMPLETED`/`PLAY_ABANDONED` — conforme au plan.
- **Idempotency (événements généraux)** : `idempotencyKey` unique en DB + check en service avant insertion — correct.
- **Taste service** : `buildTaste` calcule `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `completionRate`, `historyEventCount` — couverture complète des colonnes plan.
- **Persons enrichment** : upsert dans `persons` par `tmdbPersonId`, FK dans `media_credits.personId`, flags `isDirector`/`isCreator` — correct.
- **Backfill** : idempotent via `idempotencyKey = backfill:${profileId}:${mediaId}:${eventType}`, `schemaVersion=0`, `origin=backfill` — conforme.
- **Admin routes** : 5 endpoints présents (`interaction-stats`, `taste-stats`, `interaction-health`, `retention-stats`, `retention-compact`).
- **Rétention** : 3 classes distinctes (HIGH_VALUE, STANDARD, ANALYTICS), anonymisation search à 90j, pas de suppression des événements HIGH_VALUE — conforme au plan.
- **Instrumentation Web** : `PlayerPage` émet `PLAY_STARTED`/`RESUMED`/`PAUSED`/`COMPLETED`/`ABANDONED`, source/audio/subtitle/nextEpisode ; `useProgressSync` gère les milestones côté client et le progress keepalive. `DetailPage`, `SearchPage`, `HomePage`, `ProfileChoosePage` instrumentés.
- **Instrumentation Android TV** : `InteractionEventService` + `PlayerViewModel` (lifecycle complet) + `ProfileViewModel` (`PROFILE_SELECTED`) + `HomeViewModel` (`HOME_OPENED`) — conforme au plan.

---

## Problèmes détectés

### 🔴 BLOQUANT 1 — `playback-milestone-service.ts` est du code mort

**Fichier** : `apps/api/src/services/playback-milestone-service.ts`

La fonction `emitMilestoneIfNew` n'est importée nulle part dans la codebase :

```bash
grep -r "emitMilestoneIfNew|playback-milestone" apps/ --include="*.ts" --include="*.tsx" --include="*.kt"
# → une seule ligne : la définition elle-même
```

La déduplication serveur des milestones ne fonctionne pas. Le client Web (`useProgressSync`) émet les events `WATCHED_N_PERCENT` via `emitEvent` → `batchRecordInteractionEvents` **sans `idempotencyKey`**. Résultat : si la page est rechargée pendant la lecture, les milestones déjà atteints sont réémis et insérés en double.

**Critère de plan non satisfait** : *"WATCHED_{10|25|50|75|90}_PERCENT milestones fire at most once per (profileId, mediaId, sessionId) — verified by submitting the same milestone twice and observing a single DB row."*

**Correction minimale** — Option A (sans toucher au service) : dans `useProgressSync`, ajouter `idempotencyKey: \`${profileId}:${mediaId}:${sessionId}:WATCHED_${threshold}_PERCENT\`` à l'event émis (le profileId devra être passé en paramètre ou lu du contexte auth). Option B : wirer `emitMilestoneIfNew` depuis la route `POST /interaction-events/batch` lors du traitement des events `WATCHED_*`.

---

### 🔴 BLOQUANT 2 — `mediaType` hardcodé à `'MOVIE'` dans le service milestone

**Fichier** : `apps/api/src/services/playback-milestone-service.ts:48`

```ts
await db.insert(profileInteractionEvents).values({
  ...
  mediaType: 'MOVIE',   // ← hardcodé
```

Si le service était éventuellement branché, tous les milestones d'épisodes (séries) seraient enregistrés avec `mediaType = 'MOVIE'`, corrompant les données de recommandation. La signature de `emitMilestoneIfNew` doit recevoir `mediaType` en paramètre.

---

### 🟡 OBSERVATION 1 — Client mobile silencieusement absent

**Plan section 12** : *"Files: apps/mobile/src/ equivalent pages/hooks — Same event set as Web."*

L'arborescence `apps/` ne contient pas de client mobile (`android-tv`, `api`, `media-relay`, `web` seulement). Le plan l'a prévu explicitement et le critère de plan dit *"Mobile client emits the same set as Web."* Le coder a silencieusement sauté cette section sans le documenter dans `implementation-output.md`.

**Action attendue** : soit confirmer que le mobile n'existe pas encore dans ce projet (et mettre à jour le plan/output en conséquence), soit implémenter.

---

### 🟡 OBSERVATION 2 — `retention-service.ts` : valeurs de retour opaques et comptage standardOverdue inexact

**Fichier** : `apps/api/src/services/retention-service.ts`

```ts
return { deleted: 'compacted', anonymized: 'compacted' }  // ← chaînes fixes
```

Le retour de `runCompaction()` est inutilisable pour des diagnostics. Il devrait retourner les nombres de lignes supprimées/anonymisées.

Par ailleurs, la requête `standardOverdue` dans `getRetentionStats()` ne filtre **pas** par type d'événement — elle compte tous les événements de plus de 730 jours, y compris les HIGH_VALUE (LIKED, DISLIKED, PLAY_COMPLETED…) qui ne doivent pas être supprimés. Le chiffre affiché à `/admin/retention-stats` sera faux.

---

### 🟡 OBSERVATION 3 — `sessionId` potentiellement nul dans les milestones Web lors du premier chargement

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:106` / `apps/web/src/hooks/useProgressSync.ts`

`sessionIdRef.current` est passé à `useProgressSync` à chaque render. L'effect interne (`useEffect` avec deps `[videoRef, enabled]`) capture la valeur du paramètre `sessionId` au moment de son installation. Si la session n'est pas encore ouverte (réponse `PLAY_STARTED` en transit), les premiers milestones seront émis avec `sessionId = null`, rendant la clé d'idempotence incohérente avec les events suivants. Ce cas est rare mais doit être géré.

---

## Risques éventuels

- Doublons de milestones en base si utilisateur recharge la page pendant la lecture — directement lié au bloquant 1.
- Données de recommandation erronées (`mediaType: 'MOVIE'` pour les épisodes) si le milestone service est branché sans corriger le bloquant 2.
- Compteur `standardOverdue` incorrect dans les diagnostics admin — surcharge des alertes.

---

## Décision

REQUEST_CHANGES — deux défauts bloquants nécessitent correction avant approbation.

**Actions requises :**
1. Fixer `emitMilestoneIfNew` pour qu'il accepte `mediaType` en paramètre (supprimer le hardcode `'MOVIE'`) et brancher ce service depuis le batch handler **ou** ajouter `idempotencyKey` sur les events WATCHED_N_PERCENT dans `useProgressSync`.
2. Corriger `retention-service.ts` : retourner les vrais counts depuis `runCompaction()` et filtrer par types STANDARD uniquement dans la requête `standardOverdue`.
3. Documenter explicitement dans `implementation-output.md` l'absence de client mobile (non-existence dans le repo) afin que le plan reflète la réalité livrée.

IMPLEMENTATION_FIX_REQUIRED
