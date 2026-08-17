# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T090/reviews/implementation-review.md
- generated at: 2026-08-17T22:02:36Z

---

---

# PR Review — T090 : Fix VOD Duration/Seek Semantics (Tentative 4)

## Résumé

Quatrième review indépendante. **Le code est identique à la tentative 3 — aucune modification n'a été apportée par le coder lors de la tentative 4.** Toutes les validations techniques de la review 3 restent valides. La seule lacune est toujours la preuve de test sur un vrai flux Xtream, exigée par la règle de clôture du ticket. Ce blocage ne peut être levé que par Pierre.

---

## Vérifications effectuées

### Constat préliminaire : tentative 4 — aucun changement de code

`runs/T090/implementation-output.md` confirme : *"Aucun fichier modifié. Aucune modification de code n'est effectuée dans cette tentative #4."* Les fichiers sources sont exactement dans l'état validé par la review 3.

### Backend — inchangé, correct

**`apps/api/src/services/media-prober.ts`**
- `-show_format` présent dans l'invocation ffprobe ✓
- `format.duration` extrait et validé : `Number(d) > 0 && isFinite(Number(d))`, `null` sinon ✓
- `durationSeconds: number | null` dans `MediaInfo` ✓

**`packages/api-contracts/src/playback.ts:21`**
- `durationSeconds: number | null` dans `PlaybackProbeResult` ✓

**`apps/api/src/services/playback-resolver.ts`**
- Xtream path : `probeResult = null`, `deliveryMode = 'DIRECT'` — choix de design documenté et approuvé dans le plan ✓
- Branches cache (~l.244) et fresh (~l.259) : `durationSeconds` présent dans les logs ✓

**`apps/web/src/hooks/usePlayback.ts:51`**
- `session.probeResult?.durationSeconds ?? null` → `probeDurationSeconds` ✓

### Frontend — inchangé, correct

**`apps/web/src/pages/PlayerPage.tsx:83-89`**
- Effet `[status, probeDurationSeconds]` : reset `null` sur `'loading'`, init `probeDurationSeconds` sur `'ready'` ✓
- `PlayerControls` monté uniquement pour `status === 'ready' || 'idle'` → `stableDurationSetRef` réinitialisé à chaque remontage ✓
- `PlayerPage.tsx:370` : `stableDurationRef.current ?? (isFinite(video.duration) ? video.duration : 0)` pour le seuil resume ✓

**`apps/web/src/components/player/PlayerControls.tsx`**
- `PlayerControls.tsx:128-134` : hint locking avant le premier `durationchange` ✓
- `PlayerControls.tsx:169-177` : `onDurationChange` — retour immédiat si déjà locké ; `isFinite(d) && d > 0` obligatoire ✓
- `PlayerControls.tsx:190-196` : `onProgress` — `bufferedFraction = buf.end(...) / stableDurationRef.current`, guard `dur !== null && dur > 0` ✓
- `PlayerControls.tsx:531-576` : deux couches visuelles, état `--:-- / --:--` et seek bar `disabled` quand `null` ✓

**`apps/web/src/hooks/useProgressSync.ts`**
- Paramètre `stableDurationSeconds: number | null` ✓
- 4 chemins (`sendProgress`, `onPause`, `sendFinal`, `onBeforeUnload`) : `stableDurationRef.current ?? Math.floor(video.duration)` ✓
- Guard `!effectiveDuration || !isFinite(effectiveDuration)` présent dans tous les chemins ✓

---

## Points validés

- Chaîne complète ffprobe → contrat API → `usePlayback` → `PlayerPage` → `PlayerControls` → `useProgressSync` ✓
- Durée stable : premier `durationchange` valide (ou hint probe) gelé — aucun événement ultérieur ne fait croître la valeur ✓
- Couches visuelles buffered (`bg-white/40`) et played (`bg-white`) distinctes ✓
- État indéterminé `--:-- / --:--` + seek bar `disabled` quand `stableDuration === null` ✓
- Resume threshold calculé sur `stableDurationRef.current` ✓
- Progress sync : 4 chemins utilisent la durée stable, guard 0/non-finite bloque les écritures corrompues ✓
- Scope : aucune dérive. Pas de migration, pas de TMDB, pas de redesign global ✓
- Tests : 337 passent, dont `stableDurationSeconds=7200 > video.duration=3600` ✓

---

## Problèmes détectés

### [BLOQUANT] Règle de clôture non satisfaite — porte de validation humaine (inchangé)

Le ticket contient une règle de clôture explicite :

> *"Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."*

`runs/T090/` ne contient aucune preuve de test manuel sur un vrai flux Xtream. Les critères d'acceptation suivants ne sont pas vérifiables sans ce test :
- *Total movie duration no longer grows with buffering/loading*
- *Real duration matches the playable asset within reasonable tolerance*
- *Closing at ~25% reopens at ~25%*
- *Tested with at least one long real Xtream movie and one real episode*

**Note de cycle :** Ceci est la 4ème review consécutive émettant `IMPLEMENTATION_FIX_REQUIRED` sur ce seul point. Le code est correct et complet depuis la tentative 1. La lacune est une porte de validation humaine impossible à franchir par un agent. Le workflow est en boucle infinie depuis la tentative 2.

---

## Risques mineurs (inchangés)

### [Mineur] `onStableDuration` absente des deps de l'effet video listener
`PlayerControls.tsx:233` — `eslint-disable-next-line react-hooks/exhaustive-deps`. Sans risque concret car `handleStableDuration` est stable via `useCallback([], [])`.

### [Mineur] Xtream progressive MP4 sans fast-start
Si un stream Xtream est un MP4 avec `moov` en fin de fichier, le premier `durationchange` valide pourrait sous-estimer la durée et être gelé à tort. Non-observable sans test réel ; hors périmètre du plan.

---

## Décision

Le code est correct, complet, et sans régression. **Aucune modification de code n'est demandée.** La seule lacune est la preuve de test sur un vrai flux Xtream, qui ne peut être fournie que par Pierre.

**Action requise de Pierre pour débloquer ce ticket :**
1. Lancer l'app avec un vrai film Xtream long (≥ 60 min)
2. Vérifier que le total de la barre de progression n'augmente pas pendant le buffering
3. Fermer à ~25% de la durée réelle, rouvrir, confirmer que le dialog resume apparaît à la bonne position
4. Créer `runs/T090/evidence-real-stream.md` avec log excerpt ou screenshot
5. Relancer la review

Si Pierre juge le ticket clôturable sans cette preuve (par exemple, s'il a déjà fait ce test manuellement en dehors du workflow), il peut modifier `runs/T090/state.json` directement pour sortir de la boucle.

IMPLEMENTATION_FIX_REQUIRED
