# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T090/reviews/implementation-review.md
- generated at: 2026-08-17T21:49:56Z

---

I have everything I need. Here is the review.

---

# PR Review — T090: Fix VOD Duration/Seek Semantics (Attempt 2)

## Résumé

Le BLOQUANT 1 de la première review (stale `hintDurationSeconds` sur switch de variant) est corrigé et vérifié dans le code. Un mineur de la première review (couverture test `stableDurationSeconds` non-null) est également résolu. Le BLOQUANT 2 reste ouvert : aucune évidence de test sur un vrai flux Xtream.

---

## Vérifications effectuées

- `media-prober.ts` : extraction `format.duration`, validation `> 0 && isFinite`, null propre — confirmé lu
- `packages/api-contracts/src/playback.ts:21` : `durationSeconds: number | null` présent dans `PlaybackProbeResult` — confirmé
- `playback-resolver.ts:377,438` : `probeResult` (avec `durationSeconds`) passé dans les deux branches de retour
- `playback.ts` route : retourne `session` directement → `probeResult.durationSeconds` propagé au client
- `usePlayback.ts:51` : `session.probeResult?.durationSeconds ?? null` → `probeDurationSeconds`
- `PlayerPage.tsx:83-89` : effet reset/init `stableDurationSeconds` selon `status` — **fix BLOQUANT 1 vérifié**
- `PlayerPage.tsx:370` : `stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : 0)` pour le seuil resume
- `PlayerControls.tsx:128-134` : hint effect — lock avant premier `durationchange`
- `PlayerControls.tsx:169-177` : `onDurationChange` — gel sur premier événement valide, ignoré si déjà locké
- `PlayerControls.tsx:190-196` : `onProgress` — buffered fraction divisé par `stableDurationRef.current`
- `PlayerControls.tsx:531-576` : deux couches visuelles sur le seek bar (buffered + played), état `--:-- / --:--` quand `null`
- `useProgressSync.ts` : 4 chemins (timeupdate, pause, ended, beforeunload) utilisent `stableDurationRef.current ?? Math.floor(video.duration)`, guard 0/non-finite présent
- `useProgressSync.test.ts:126-140` : test `stableDurationSeconds=7200` vs `video.duration=3600` — **mineur de la première review résolu**

---

## Points validés

- **BLOQUANT 1 résolu** : `PlayerPage.tsx:83-89` — l'effet réinitialise bien `stableDurationSeconds` à `null` sur `status === 'loading'` et le recharge depuis `probeDurationSeconds` sur `status === 'ready'`. La séquence de montage/démontage de `PlayerControls` garantit qu'aucun lock stale ne peut se produire : `PlayerControls` n'est rendu que quand `status === 'ready' || status === 'idle'`, donc il remonte toujours après que l'effet de reset se soit exécuté. ✓

- **Backend** : chaîne complète `ffprobe → MediaInfo.durationSeconds → PlaybackProbeResult.durationSeconds → API response → usePlayback → PlayerPage`. Validation numérique (`Number() > 0 && isFinite()`) propre. ✓

- **Xtream bypass** : `probeResult = null` pour les sources Xtream (design approuvé) → `probeDurationSeconds = null` → `hintDurationSeconds = null` → `PlayerControls` se rabat sur le premier `durationchange` valide. Comportement conforme au plan. ✓

- **Visual layers** : deux `div` sur la track (buffered `bg-white/40`, played `bg-white`), thumb positionné correctement, seek bar désactivée/opacity-50 quand `null`. ✓

- **Resume dialog** : seuil calculé sur `stableDurationRef.current` en priorité. ✓

- **Test coverage** : le test manquant est ajouté — `stableDurationSeconds=7200` prend la priorité sur `video.duration=3600`. ✓

- **Scope** : aucune dérive. Pas de migration, pas de TMDB, pas de redesign global. ✓

---

## Problèmes détectés

### [BLOQUANT] Absence d'évidence de test sur un vrai flux

Le ticket contient une règle de clôture explicite et non-négociable :

> *"Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."*

Le dossier `runs/T090/` ne contient ni screenshot, ni log excerpt, ni aucune évidence d'un test manuel sur un vrai stream Xtream. L'`implementation-output.md` le reconnaît explicitement :

> *"The real-stream validation... must be done manually by running the app against a real Xtream movie. This cannot be satisfied in code."*

C'est correct — l'agent coding ne peut pas exécuter un navigateur contre un vrai flux IPTV. Il s'agit d'une **porte de validation humaine**, pas d'un bug de code.

Les critères d'acceptation en attente de validation :
- *"Total movie duration no longer grows with buffering/loading"*
- *"Real duration matches the playable asset within reasonable tolerance"*
- *"Closing at ~25% reopens at ~25%, not at a position distorted by prior buffer state"*
- *"Tested with at least one long real Xtream movie and one real episode"*

---

## Risques éventuels

### [Mineur] `onStableDuration` absente des deps de l'effet video listener

`PlayerControls.tsx:233` — `onStableDuration` capturée dans `onDurationChange` mais absente du tableau de dépendances sous `eslint-disable-next-line react-hooks/exhaustive-deps`. Sans danger en pratique (`handleStableDuration` est stable via `useCallback([], [])`), mais l'annotation masque l'omission. Non-bloquant, notifié pour cohérence.

### [Mineur] `durationSeconds` absent du log `probe_result`

`playback-resolver.ts:258-266` — les logs `probe_result` (fresh et cache) n'incluent pas `durationSeconds`. Information utile pour diagnostics futurs. Non-bloquant.

### [Mineur] Xtream sans fast-start (moov à la fin)

Pour les sources Xtream MP4 sans `moov` en tête de fichier, le premier `durationchange` valide peut arriver avec une durée sous-estimée puis s'ajuster, qui serait alors gelée. Ce cas reste non-observable sans test réel.

---

## Décision

Le seul bloquant restant est la validation réelle sur un vrai flux Xtream — exigence explicite du ticket. Le code est correct et complet. La démonstration sur vrai flux doit être faite par un humain avec accès à un stream Xtream réel, et les résultats (logs ou screenshots) doivent être déposés dans `runs/T090/`.

IMPLEMENTATION_FIX_REQUIRED
