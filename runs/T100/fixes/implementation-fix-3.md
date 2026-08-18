# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T100/reviews/implementation-review.md
- generated at: 2026-08-18T12:21:00Z

---

Now I have a complete picture. Writing the final review.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

C'est la troisième passe de review après deux cycles de correction. L'implémentation est globalement solide : schéma DB complet, taxonomie de 50 événements, service de session, milestones dédupliqués côté serveur, taste service enrichi avec 7 dimensions supplémentaires, backfill idempotent, rétention par classe, admin routes, et instrumentation complète Web + Android TV. Les deux bloquants de la review 1 (milestone service câblé, `mediaType` hardcodé, retours de rétention) ont bien été corrigés.

Un seul bloquant subsiste : le contrat API `ProfileTaste` n'expose pas les nouvelles dimensions calculées par T100, rendant le critère principal du ticket invérifiable en pratique.

---

## Vérifications effectuées

- Migration `0040_t100_profile_interaction_events_v2.sql` relue intégralement
- Schéma Drizzle : `profile-interaction-events.ts`, `viewing-sessions.ts`, `persons.ts`, `profile-taste.ts`, `media-credits.ts`
- Services : `interaction-event-service.ts`, `viewing-session-service.ts`, `playback-milestone-service.ts`, `profile-taste-service.ts`, `retention-service.ts`
- Routes : `interaction-events.ts` (batch handler), `admin.ts` (5 routes)
- Contrat API : `packages/api-contracts/src/taste.ts`, `interaction-events.ts`
- Client Web : `PlayerPage.tsx`, `useInteractionEvents.ts`, `useProgressSync.ts`
- Android TV : `PlayerViewModel.kt` (cycle complet play/abandon)
- Script : `backfill-interaction-events.ts`
- Reviews précédentes : `runs/T100/reviews/implementation-review.md`

---

## Points validés

- **Schéma DB** : tous les champs du plan présents, migration additive (`IF NOT EXISTS`), cascade DELETE sur `profileId` dans les trois tables, `ON DELETE SET NULL` sur `sessionId`. Indexes complets : `(profileId, eventType)`, `(profileId, mediaId)`, `(sessionId)`, `(occurredAt)`.
- **Taxonomie** : 50 types définis dans `ALLOWED_EVENT_TYPES` et le type `InteractionEventType`; inconnus rejetés en 400.
- **Batch endpoint** : best-effort, jamais de 5xx pour analytics, session ouverte sur `PLAY_STARTED` avec `sessionId` retourné, session fermée sur `PLAY_COMPLETED`/`PLAY_ABANDONED`.
- **Milestone deduplication** : `emitMilestoneIfNew` est câblé dans le batch handler (`interaction-events.ts:70-79`), prend `mediaType` en paramètre, génère une `idempotencyKey` correcte `${profileId}:${mediaId}:${sessionId}:${milestone}`. Bloquant 1 et 2 de la review précédente corrigés.
- **Idempotency générale** : check SELECT avant INSERT + unique index conditionnel — correct pour la sémantique analytics.
- **Taste service** : `buildTaste` calcule `personScores`, `keywordScores`, `franchiseScores`, `languageScores`, `countryScores`, `decadeScores`, `mediaTypePreferences`, `completionRate`, `historyEventCount`, `tasteVersion` — toutes les dimensions plan. Upsert avec bump `tasteVersion`.
- **Persons enrichment** : upsert `persons` par `tmdbPersonId`, FK `personId` dans `media_credits`, flags `isDirector`/`isCreator`. Correct.
- **Rétention** : `runCompaction()` retourne `{ deleted: number, anonymized: number }` (counts réels). `getRetentionStats()` filtre correctement par `STANDARD_TYPES` et `ANALYTICS_TYPES`. Bloquants rétention corrigés.
- **Backfill** : idempotent via `idempotencyKey = backfill:${profileId}:${mediaId}:${eventType}`, `schemaVersion=0`, `origin=backfill` — conforme, ne fabrique pas de timestamps inconnus.
- **Admin routes** : 5 endpoints présents et fonctionnels ; `interaction-health` calcule le milestone coverage correctement.
- **Android TV** : `emitAbandonIfNeeded()` appelé dans `stop()` avec `NonCancellable`, flag `sessionEnded` empêche les doublons — correct.
- **Web player** : `PLAY_STARTED` via batch (reçoit `sessionId`), cycle complet sur événements HTML5 video, `PLAY_ABANDONED` sur unmount — correct.

---

## Problèmes détectés

### 🔴 BLOQUANT — Contrat API `ProfileTaste` n'expose pas les nouvelles dimensions

**Fichier** : `packages/api-contracts/src/taste.ts` et `apps/api/src/services/profile-taste-service.ts`

Le type `ProfileTaste` n'a pas été mis à jour :

```typescript
// packages/api-contracts/src/taste.ts
export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  // ← personScores, keywordScores, franchiseScores, languageScores,
  //   countryScores, decadeScores, mediaTypePreferences,
  //   completionRate, historyEventCount, tasteVersion ABSENTS
}
```

La fonction `buildOutput` (profile-taste-service.ts:46-86) reçoit ces champs dans le paramètre `extra` mais ne les inclut pas dans l'objet retourné. Les 7 nouvelles dimensions sont correctement calculées et persistées en DB, mais jamais exposées par l'API.

Conséquences directes :
- Le critère du plan *"profile_taste record includes personScores, keywordScores, franchiseScores, languageScores, decadeScores after POST /taste/rebuild"* ne peut pas être vérifié via l'API.
- Les futurs algorithmes appelant `GET /taste/:profileId` ne voient que les genre scores — les dimensions person/keyword/franchise/language/decade sont inaccessibles sans requête DB directe.
- Le ticket §13/14 (taste model pipeline, explainability readiness) est partiellement bloqué.

**Correction minimale :**

1. Étendre `ProfileTaste` dans `packages/api-contracts/src/taste.ts` :
```typescript
export type ProfileTaste = {
  profileId: string
  genreScores: GenreScore[]
  positiveMediaIds: string[]
  negativeMediaIds: string[]
  signalCount: number
  builtAt: string
  personScores: Record<string, number>
  personMeta: Record<string, { name: string; role: string }>
  keywordScores: Record<string, number>
  franchiseScores: Record<string, number>
  languageScores: Record<string, number>
  countryScores: Record<string, number>
  decadeScores: Record<string, number>
  mediaTypePreferences: Record<string, number>
  completionRate: number | null
  historyEventCount: number
  tasteVersion: number
}
```

2. Inclure `extra` dans le return de `buildOutput` (profile-taste-service.ts:78-85).

---

### 🟡 OBSERVATION 1 — Dérive schema/migration pour `sessionId` FK

**Fichier** : `apps/api/src/db/schema/profile-interaction-events.ts:33`

```typescript
sessionId: uuid('session_id'),  // ← aucune référence FK
```

La migration SQL ajoute correctement `REFERENCES "viewing_sessions"("id") ON DELETE SET NULL`. Mais le schéma Drizzle n'a pas de `.references()` correspondant. Un `drizzle-kit check` ou `push` détectera une dérive et génèrera une migration parasite. À corriger pour aligner le schéma ORM sur la DB réelle.

---

### 🟡 OBSERVATION 2 — `tasteVersion` retourné comme `1` systématiquement

**Fichier** : `apps/api/src/services/profile-taste-service.ts:349`

```typescript
return buildOutput(profileId, ..., {
  ...
  tasteVersion: 1,  // ← hardcodé, ne reflète pas le vrai incrément DB
})
```

Sur un rebuild (conflict path), la DB a `tasteVersion = sql\`...+1\`` mais l'API retourne toujours 1. Non bloquant maintenant car `tasteVersion` n'est pas dans le contrat — mais ce sera incorrect dès que le type sera étendu (voir bloquant ci-dessus). À corriger en même temps.

---

### 🟡 OBSERVATION 3 — Mobile non documenté comme absent

Le plan §12 et le critère de plan "Mobile client emits the same set as Web" sont non satisfaits. `apps/mobile/` n'existe pas. L'`implementation-output.md` ne le mentionne pas explicitement. À documenter comme out-of-scope pour clarifier le delta entre plan et livraison.

---

## Risques éventuels

- **Données taste inaccessibles via API** : futur développeur qui intègre le taste service obtiendra des objets partiels sans avertissement — risque de régression silencieuse sur les futures features recommandation.
- **Drizzle schema drift** : le décalage `sessionId` FK risque de créer une fausse migration lors du prochain `drizzle-kit generate`, potentiellement appliquée en production.

---

## Décision

REQUEST_CHANGES — un défaut bloquant à corriger : le contrat `ProfileTaste` doit exposer les nouvelles dimensions calculées par T100. Les deux observations sont mineures et peuvent être traitées dans le même patch.

**Actions requises :**
1. **[Bloquant]** Étendre `ProfileTaste` dans `packages/api-contracts/src/taste.ts` avec les 10 champs manquants et mettre à jour `buildOutput` pour les inclure dans le retour.
2. **[Bloquant, même correctif]** Corriger `tasteVersion: 1` hardcodé dans l'appel `buildOutput` de `buildTaste()` — passer la valeur issue du contexte (1 pour insert, la valeur DB pour les consommateurs de `getTaste`).
3. **[Mineur]** Ajouter `.references(() => viewingSessions.id, { onDelete: 'set null' })` sur `sessionId` dans le schéma Drizzle.

IMPLEMENTATION_FIX_REQUIRED
