Now I have a complete picture. Let me write the review.

---

# PR Review — T090: Fix VOD Duration/Seek Semantics

## Résumé

L'implémentation est structurellement correcte et couvre le plan approuvé. Les fichiers modifiés sont en scope. Deux points bloquants ont été identifiés : un bug sur le switch de variant pour les sources non-Xtream, et l'absence d'évidence de tests sur un vrai flux — exigence explicite du ticket.

---

## Vérifications effectuées

- `media-prober.ts` : extraction et validation de `durationSeconds`
- `playback.ts` (contracts) : champ `durationSeconds: number | null` ajouté
- `playback-resolver.ts` : mapping `probeResult` → `PlaybackSessionResponse`
- `usePlayback.ts` : extraction de `probeDurationSeconds`
- `useProgressSync.ts` : fallback `stableDurationSeconds ?? Math.floor(video.duration)`, guard 0/non-finite
- `PlayerControls.tsx` : freeze sur premier `durationchange` valide, état indéterminé, hint probe
- `PlayerPage.tsx` : wiring probe → `stableDurationSeconds` → hook + controls
- Tests mis à jour (`durationSeconds: null` dans fixtures, signature 5-args)

---

## Points validés

- **Backend** : `media-prober.ts` valide correctement (`isFinite && > 0`), null propre si absent. Structural typing `MediaInfo` ↔ `PlaybackProbeResult` — OK.
- **Frontend - logique de gel** : `stableDurationSetRef` + `stableDuration` state — le gel sur premier `durationchange` valide est correct. L'état `--:-- / --:--` pour `stableDuration === null` est conforme à la spec.
- **`useProgressSync`** : `stableDurationRef.current` mis à jour à chaque render (pattern ref synchrone), le fallback `Math.floor(video.duration)` est utilisé uniquement si pas encore de valeur stable. Guard `!effectiveDuration || !isFinite(effectiveDuration)` correct.
- **Resume dialog** : `stableDurationRef.current ?? video.duration` comme dénominateur — correct.
- **Scope** : aucune dérive. Pas de migrations, pas de TMDB, pas de redesign visuel total.

---

## Problèmes détectés

### [BLOQUANT 1] Stale `hintDurationSeconds` sur switch de variant (sources non-Xtream)

**Fichier** : `apps/web/src/pages/PlayerPage.tsx:83-87`

Lors d'un switch de variant pour une source non-Xtream avec durée probée :

1. `switchVariant()` → `status='loading'` → `PlayerControls` démonté
2. Resolve complète → `setProbeDurationSeconds(newDuration)` + `setStatus('ready')` (batchés React 18)
3. **Render** : `status='ready'`, `stableDurationSeconds` = **ancienne valeur** (l'effet ne s'est pas encore exécuté), `probeDurationSeconds` = nouvelle valeur
4. `PlayerControls` monte avec `hintDurationSeconds = ancienne valeur` → hint effect : `stableDurationSetRef.current = false`, ancienne valeur > 0 → **lock sur l'ancienne durée**
5. Post-render, l'effet `setStableDurationSeconds(newDuration)` s'exécute → render suivant → hint effect ignoré (`stableDurationSetRef.current = true`)

**Résultat** : le player affiche la durée de l'ancienne source pour le nouveau variant.

**Fix** : réinitialiser `stableDurationSeconds` à `null` quand le status passe en `loading` :

```ts
// PlayerPage.tsx
useEffect(() => {
  if (status === 'loading') {
    setStableDurationSeconds(null)
  } else if (status === 'ready') {
    setStableDurationSeconds(probeDurationSeconds)
  }
}, [status, probeDurationSeconds])
```

### [BLOQUANT 2] Absence d'évidence de test sur un vrai flux

Le ticket contient une règle de clôture explicite :

> *"Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."*

Les tests unitaires (`useProgressSync.test.ts`) passent `null` pour `stableDurationSeconds` et utilisent `duration=3600` simulé — exactement ce que la règle interdit comme preuve suffisante. `runs/T090/` ne contient ni screenshot, ni log excerpt d'un vrai stream Xtream.

Les critères d'acceptation non vérifiables sans test réel :
- *"Total movie duration no longer grows with buffering/loading"*
- *"Real duration matches the playable asset within reasonable tolerance"*
- *"Closing at ~25% reopens at ~25%, not at a position distorted by prior buffer state"*
- *"Tested with at least one long real Xtream movie and one real episode"*

---

## Risques éventuels

### [Mineur] `onStableDuration` absente des deps de l'effet video listener

`apps/web/src/components/player/PlayerControls.tsx:233`

```ts
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [videoRef])
```

`onStableDuration` est capturée en closure mais absente du tableau. Sans danger en pratique car `handleStableDuration` est stable (`useCallback([], [])`), mais le `eslint-disable` historique masque maintenant cette omission nouvelle.

### [Mineur] Xtream bypass probe → first-valid-durationchange

Pour les sources Xtream, `probeResult` est toujours `null` (design voulu, plan approuvé). Pour les MP4 Xtream sans fast-start (moov à la fin), le premier `durationchange` valide peut reporter une durée incomplète qui serait gelée. Ce cas n'est pas observable sans test réel (cf. bloquant 2).

### [Mineur] Couverture test `stableDurationSeconds` non-null absente

`useProgressSync.test.ts` ne couvre pas le chemin où `stableDurationSeconds` est non-null et prend la priorité sur `video.duration`. Le comportement clé du ticket n'est pas testé unitairement.

---

## Décision

Deux bloquants :
1. Bug sur le reset de `stableDurationSeconds` en cas de switch de variant — **fix de code requis**
2. Absence d'évidence de test réel sur un vrai flux Xtream — **exigence de clôture du ticket non satisfaite**

IMPLEMENTATION_FIX_REQUIRED
