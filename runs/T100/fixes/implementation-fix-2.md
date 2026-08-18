# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T100/reviews/implementation-review.md
- generated at: 2026-08-18T12:08:29Z

---

I have all the information needed for the review. Let me write it now.

---

# PR Review — T100: Capture and persist comprehensive profile interaction data

## Résumé

Implémentation très complète et structurée d'un système de collecte de signaux comportementaux par profil. Le schéma DB, la taxonomie d'événements, le service d'ingestion, les milestones, le modèle de goût enrichi, la rétention et les diagnostics admin sont tous correctement implémentés. Un problème bloquant identifié côté Android TV : les sessions de visionnage ouvertes sur cette plateforme ne sont jamais fermées en cas d'abandon.

## Vérifications effectuées

- Migration `0039` : colonnes, contraintes, index
- Service `interaction-event-service.ts` : taxonomie (44 types), idempotence, validation métadonnées
- `viewing-session-service.ts` : ouverture, mise à jour, fermeture
- `playback-milestone-service.ts` : déduplication par clé d'idempotence
- `retention-service.ts` : 3 classes correctement traitées, comptages retournés
- `profile-taste-service.ts` : accumulation de features, upsert avec bump tasteVersion
- `backfill-interaction-events.ts` : idempotence, marquage origin/schemaVersion
- `admin.ts` : 5 endpoints diagnostics
- Web : `useInteractionEvents`, `useProgressSync` (milestones par seuil, chacun émis une seule fois)
- Android TV : `InteractionEventService`, `PlayerViewModel`, `HomeViewModel`

## Points validés

- **DB** : Toutes les colonnes du plan présentes (`seriesId`, `seasonId`, `progressPercent`, `shelfConceptId`, `sessionId`, `idempotencyKey`, etc.). Index partiels (WHERE NOT NULL), ON DELETE CASCADE sur `profileId`, ON DELETE SET NULL sur `sessionId` — corrects.
- **Taxonomie** : 44 types (plan cible ~47). Les 3 manquants (`SEARCH_RESULT_IMPRESSION` compté différemment, stubs `RATED`/`REMINDER_ADDED` présents). Acceptable.
- **Ingestion batch** : Best-effort, jamais 5xx pour analytics, cap 50 événements, 4KB metadata max.
- **Milestones** : Déduplication serveur via `emitMilestoneIfNew`, côté Web chaque seuil est émis indépendamment dans `useProgressSync` via `emittedMilestonesRef`. Correct.
- **Rétention** : 4 classes (HIGH_VALUE indefini, STANDARD 730j, ANALYTICS 90j, SEARCH query nullée à 90j). `runCompaction()` retourne les vrais comptages.
- **Profile taste** : Tous les scores enrichis (person, keyword, franchise, language, country, decade) calculés et persistés en DB. `tasteVersion` incrémenté via `sql` expression. Complet.
- **Backfill** : Idempotent, `schemaVersion=0`, `origin: backfill`, aucun timestamp inventé.
- **Cascade suppression** : `profile_interaction_events`, `viewing_sessions` et `profile_taste` tous en ON DELETE CASCADE sur `profileId`.
- **Diagnostics admin** : 5 endpoints conformes au plan.
- **Fire-and-forget** : Web et Android TV n'bloquent jamais l'UI sur analytics.

## Problèmes détectés

### 🔴 BLOQUANT — Android TV : sessions de visionnage jamais fermées en cas d'abandon

**Fichier** : `apps/android-tv/app/src/main/kotlin/com/iptvflix/androidtv/player/PlayerViewModel.kt`

`stop()` (appelé quand l'utilisateur navigue en arrière) et `onCleared()` (appelé à la destruction du ViewModel) ne font ni `emitEvent("PLAY_ABANDONED")` ni `closeSession()`.

Seul `STATE_ENDED` (`PLAY_COMPLETED`) ferme correctement la session. Tout autre cas de sortie (retour arrière, app en arrière-plan, changement de media) laisse la session avec `endedAt = null`.

Conséquence : accumulation de sessions ouvertes non terminées en DB. Le critère `«PLAY_COMPLETED / PLAY_ABANDONED closes it»` n'est pas rempli sur Android TV.

**Correction attendue** :
```kotlin
fun stop() {
    viewModelScope.launch(NonCancellable) { 
        progressReporter?.reportNow()
        sessionId?.let { sid ->
            runCatching {
                interactionEvents.emit(mapOf(
                    "eventType" to "PLAY_ABANDONED",
                    "mediaType" to (currentCommand?.mediaType?.uppercase() ?: ""),
                    "mediaId" to (currentCommand?.mediaId ?: ""),
                    "clientType" to "android-tv",
                    "sessionId" to sid,
                    "positionMs" to player.currentPosition,
                ))
                // appel closeSession via API ou batch
            }
        }
    }
    reporterJob?.cancel()
    player.stop()
    _uiState.value = PlayerUiState.Idle
}
```
Le même pattern est nécessaire dans `onCleared()` (avec `withTimeout(2_000L)` comme déjà fait pour le progress report).

---

## Risques éventuels

**OBSERVATION 1 — N+1 queries dans `buildTaste`**

`accumulateMediaFeatures()` effectue plusieurs requêtes DB individuelles (genres, movie/series features, credits) pour chaque item du profil. Pour un profil avec 50+ items, cela génère 250+ aller-retours séquentiels. Correct fonctionnellement aujourd'hui, mais à optimiser par batch SQL avant mise à l'échelle.

**OBSERVATION 2 — `buildOutput` n'expose pas les champs étendus du taste dans la réponse API**

`buildOutput` retourne la forme étroite de `ProfileTaste` (genreScores, positiveMediaIds, negativeMediaIds, signalCount, builtAt). Les champs `personScores`, `keywordScores`, `franchiseScores`, etc. sont bien stockés en DB mais pas retournés par `buildTaste`/`getTaste`. Le critère «profile_taste record includes personScores…» est satisfait pour le row DB, mais pas pour la réponse API. À étendre avec `ProfileTaste` si des consommateurs ont besoin de ces champs via l'API.

**OBSERVATION 3 — `mediaType = 'EPISODE'` dans le backfill**

Le script de backfill émet des événements avec `mediaType = 'EPISODE'` pour les épisodes (différent de `'SERIES'` utilisé dans `profile-taste-service`). Les futurs algorithmes lisant ces événements devront gérer explicitement ce type ou une normalisation sera nécessaire.

**OBSERVATION 4 — Mobile client absent**

`apps/mobile` n'existe pas dans le repo. La section 12 du plan est hors scope comme documenté. Le critère "Mobile client emits the same set as Web" reste non rempli — acceptable tant que l'app mobile n'existe pas.

## Décision

- REQUEST_CHANGES

## Actions demandées

1. **[BLOQUANT]** Émettre `PLAY_ABANDONED` et appeler `closeSession` dans `PlayerViewModel.stop()` et `onCleared()` sur Android TV. Sans ce fix, le `ViewingSession.endedAt` ne sera jamais renseigné pour les abandons, ce qui invalide la distinction abandon/completion sur cette plateforme.

IMPLEMENTATION_FIX_REQUIRED
