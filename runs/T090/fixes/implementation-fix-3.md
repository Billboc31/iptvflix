# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T090/reviews/implementation-review.md
- generated at: 2026-08-17T21:56:39Z

---

I have everything I need for an independent review. Let me write the assessment.

---

# PR Review — T090: Fix VOD Duration/Seek Semantics (Attempt 3)

## Résumé

Troisième review indépendante. L'implémentation est correcte et complète du point de vue du code. La seule lacune restante est une porte de validation humaine exigée explicitement par la règle de clôture du ticket. Le correctif mineur de la review 2 (`durationSeconds` dans les logs `probe_result`) a bien été appliqué.

---

## Vérifications effectuées — lecture directe du code

### Backend

**`apps/api/src/services/media-prober.ts`**
- ffprobe invoqué avec `-show_format` ✓
- `format.duration` extrait, validé `Number(d) > 0 && isFinite(Number(d))`, retourne `null` sinon ✓
- Typage `durationSeconds: number | null` dans `MediaInfo` ✓

**`packages/api-contracts/src/playback.ts:21`**
- `durationSeconds: number | null` présent dans `PlaybackProbeResult` ✓

**`apps/api/src/services/playback-resolver.ts:231-232`**
- Xtream path: `probeResult = null`, `deliveryMode = 'DIRECT'` — design explicitement documenté et approuvé dans le plan ✓
- Lignes ~244-268: les deux branches (cache et fresh) incluent maintenant `durationSeconds` dans les logs — **fix mineur de la review 2 confirmé** ✓

**`apps/web/src/hooks/usePlayback.ts:51`**
- `session.probeResult?.durationSeconds ?? null` → `probeDurationSeconds` ✓

### Frontend

**`apps/web/src/pages/PlayerPage.tsx:83-89`**
- Effet `[status, probeDurationSeconds]` : reset `null` sur `'loading'`, init depuis `probeDurationSeconds` sur `'ready'`. Empêche le lock stale sur switch de variant ✓
- `PlayerPage.tsx:370`: `stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : 0)` pour le seuil resume ✓

**`apps/web/src/components/player/PlayerControls.tsx:128-134`**
- Effet hint: lock `stableDuration` avant le premier `durationchange` lorsque `hintDurationSeconds` est non-null ✓
- `PlayerControls.tsx:169-177`: `onDurationChange` — retour immédiat si déjà locké ; accepte uniquement `isFinite(d) && d > 0` ✓
- `PlayerControls.tsx:190-196`: `onProgress` — `bufferedFraction = buf.end(...) / stableDurationRef.current`, guard `dur !== null && dur > 0` ✓
- `PlayerControls.tsx:531-576`: deux couches visuelles `bg-white/40` (buffered) et `bg-white` (played) ; `--:-- / --:--` et seek bar `opacity-50` / `disabled` quand `null` ✓

**`apps/web/src/hooks/useProgressSync.ts`**
- Paramètre `stableDurationSeconds: number | null` ✓
- 4 chemins (timeupdate `sendProgress`, pause `onPause`, ended `sendFinal`, beforeunload `onBeforeUnload`) : `stableDurationRef.current ?? Math.floor(video.duration)` ✓
- Guard `!effectiveDuration || !isFinite(effectiveDuration)` présent dans tous les chemins ✓

---

## Points validés

- **Chaîne complète** ffprobe → contrat API → `usePlayback` → `PlayerPage` → `PlayerControls` → `useProgressSync` : entièrement vérifiée. ✓
- **Durée stable** : le premier `durationchange` valide (ou le hint probe) est gelé ; aucun événement ultérieur ne peut faire croître la valeur affichée. ✓
- **Couches visuelles** : buffered et played sont deux layers distincts sur la track, conforme au ticket. ✓
- **État indéterminé** : `--:-- / --:--` + seek bar désactivé quand `stableDuration === null`. ✓
- **Resume** : seuil calculé sur `stableDurationRef.current`, fallback propre sur `video.duration`. ✓
- **Progress sync** : 4 chemins utilisent la durée stable, guard 0/non-finite bloque les écritures corrompues. ✓
- **Scope** : aucune dérive. Pas de migration, pas de TMDB, pas de redesign global. ✓
- **Tests** : 337 tests passent, dont le test `stableDurationSeconds=7200` > `video.duration=3600`. ✓

---

## Problèmes détectés

### [BLOQUANT] Règle de clôture du ticket non satisfaite — porte de validation humaine

Le ticket contient une règle de clôture explicite et non-négociable :

> *"Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."*

Le dossier `runs/T090/` ne contient aucune évidence d'un test manuel sur un vrai flux Xtream (ni screenshot, ni log excerpt, ni capturer les valeurs `video.duration`, `video.buffered`, `video.seekable`).

Critères d'acceptation non vérifiables sans ce test :
- *"Total movie duration no longer grows with buffering/loading"*
- *"Real duration matches the playable asset within reasonable tolerance"*
- *"Closing at ~25% reopens at ~25%, not at a position distorted by prior buffer state"*
- *"Tested with at least one long real Xtream movie and one real episode"*

**Note critique** : Il s'agit d'une porte de validation humaine, non d'un défaut de code. Le code est correct et aucune modification supplémentaire n'est nécessaire. Le workflow est bloqué parce que l'agent coding ne peut pas exécuter un navigateur contre un vrai flux IPTV.

**Action requise (humaine)** :
1. Lancer l'application contre un vrai film Xtream long (≥ 60 min).
2. Observer que le total de la barre ne croît pas pendant le buffering.
3. Fermer à ~25% de la durée, rouvrir, vérifier que le dialog resume apparaît à la position correcte.
4. Déposer un log excerpt ou screenshot dans `runs/T090/` (e.g. `runs/T090/evidence-real-stream.md`).
5. Re-déclencher la review.

---

## Risques mineurs (inchangés des reviews précédentes)

### [Mineur] `onStableDuration` absente des deps de l'effet video listener
`PlayerControls.tsx:233` — annotée `eslint-disable-next-line react-hooks/exhaustive-deps`. Sans risque concret car `handleStableDuration` est stable via `useCallback([], [])`.

### [Mineur] Xtream MP4 sans fast-start (moov à la fin)
Pour des streams Xtream progressive MP4 sans `moov` en tête de fichier, le premier `durationchange` valide pourrait sous-estimer la durée et serait alors gelé. Non-observable sans test réel, et exclu du périmètre du plan.

---

## Décision

Le code est correct, complet, et sans régression. La seule lacune est la preuve de validation sur un vrai flux Xtream — exigence non-négociable du ticket. Cette preuve ne peut être fournie que par un humain disposant d'un accès à un stream Xtream réel.

IMPLEMENTATION_FIX_REQUIRED
