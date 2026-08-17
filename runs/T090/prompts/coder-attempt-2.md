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


# T090 — Fix VOD duration/seek semantics and make resume use true media duration

**Source**: GitHub Issue #190

## Description

## Context
During VOD playback, the displayed total duration is currently wrong: the maximum duration appears to grow progressively as more of the stream loads. This makes the timeline visually misleading and causes resume/progress percentages to be incorrect.

A movie should have a stable real total duration from the beginning (or as soon as metadata is known), independent of how much has buffered/downloaded.

## Goal
Separate these concepts correctly:
- true media duration;
- current playback position;
- buffered ranges;
- seekable ranges;
- downloaded/loaded progress.

The player timeline and resume logic must use TRUE media duration, never buffered-end or loaded bytes as a fake duration.

## Investigation
For a real Xtream movie that reproduces the issue, capture:
- `video.duration`;
- `video.seekable` ranges;
- `video.buffered` ranges;
- stream/container type;
- HLS/native/direct delivery mode;
- server `Content-Length`, `Accept-Ranges`, `Content-Range` behavior where applicable;
- ffprobe-reported duration;
- any EXT-X metadata if HLS is used.

Identify exactly why duration currently increases progressively.

## Backend/media metadata
Where reliable duration is already available from TMDB/provider/ffprobe/database, expose/use it as metadata, but do not blindly trust catalog runtime if it differs materially from the playable asset.

For playable availability, consider storing/probing actual media duration when needed so the UI can initialize correctly.

If MP4 duration is unavailable until tail metadata/moov atom is fetched, investigate Range request behavior or metadata probing rather than using buffered duration.

If HLS is used, compute duration correctly from VOD playlist metadata (`#EXTINF` / ENDLIST) or media duration exposed by the browser/player.

## Timeline
- Timeline max must represent total duration.
- Buffered portion should be rendered as a separate visual layer.
- Played portion should be another layer.
- Seeking should use actual seconds/time ranges.
- If total duration is temporarily unknown, show an explicit indeterminate state rather than a growing fake total.

## Resume/progress
Persist absolute playback seconds plus reliable duration/percentage semantics.

Resume logic must NOT calculate progress from `currentTime / bufferedEnd` or any other loading metric.

Example:
- movie actual duration: 7200s
- user closes at 1800s
- persisted progress = 1800s (~25%), regardless of whether only 2200s had buffered.

When reopening:
- seek to saved absolute position when media is ready/seekable;
- clamp against real duration;
- avoid resume prompt for trivial start/end positions;
- completed status based on real duration/end threshold.

## Acceptance criteria
- [ ] Total movie duration no longer grows with buffering/loading.
- [ ] Player visually distinguishes total, played and buffered progress.
- [ ] Real duration matches the playable asset within reasonable tolerance.
- [ ] Unknown duration has an honest fallback state.
- [ ] Resume stores/restores absolute seconds correctly.
- [ ] Resume percentage uses real total duration.
- [ ] Closing at ~25% reopens at ~25%, not at a position distorted by prior buffer state.
- [ ] Seek bar remains usable after metadata becomes available.
- [ ] Tested with at least one long real Xtream movie and one real episode.

## Completion rule
Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Implementation complete. Here's a summary of all changes:

---

## Files Modified

### Backend

**`apps/api/src/services/media-prober.ts`**
- Added `durationSeconds: number | null` to `MediaInfo` type
- Extracts `format.duration` from ffprobe JSON output; validates it's finite and positive

**`packages/api-contracts/src/playback.ts`**
- Added `durationSeconds: number | null` to `PlaybackProbeResult`

### Frontend

**`apps/web/src/hooks/usePlayback.ts`**
- Added `probeDurationSeconds: number | null` state — extracted from `session.probeResult?.durationSeconds`

**`apps/web/src/hooks/useProgressSync.ts`**
- Added `stableDurationSeconds: number | null` as 5th parameter
- All progress persist calls use `stableDurationSeconds ?? Math.floor(video.duration)` — prevents writing buffered-end as fake duration
- Guard: skips any persist call where the effective duration is 0 or non-finite

**`apps/web/src/components/player/PlayerControls.tsx`**
- Replaced `duration` state with `stableDuration: number | null`
- New `hintDurationSeconds` prop: when non-null, locks the stable duration immediately (probe-authoritative)
- `onDurationChange` now accepts only the **first valid** `video.duration` value; all subsequent `durationchange` events are ignored — this is the core fix for the growing-bar bug
- `onProgress` (buffered fraction) uses `stableDurationRef.current` instead of `video.duration`
- Time display shows `--:-- / --:--` when duration unknown (honest indeterminate state)
- New `onStableDuration` callback prop — fires once when duration first becomes known
- `skip()` uses stable duration as clamp ceiling

**`apps/web/src/pages/PlayerPage.tsx`**
- Owns `stableDurationSeconds` state: initialized from `probeDurationSeconds` on session resolve, updated via `onStableDuration` callback
- Resume dialog threshold now uses `stableDurationRef.current ?? video.duration` (correct even before the first durationchange)
- Passes `hintDurationSeconds` and `onStableDuration` to `PlayerControls`
- Passes `stableDurationSeconds` to `useProgressSync`

### Tests updated (my new type broke them)

**`apps/api/src/__tests__/playback-compat.test.ts`** — `info()` helper: added `durationSeconds: null`  
**`apps/api/src/__tests__/probe-cache.test.ts`** — fixture objects: added `durationSeconds: null`  
**`apps/web/src/hooks/useProgressSync.test.ts`** — updated 5-arg call signature (passing `null`)

---

## Review

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

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T090/reviews/implementation-review.md
- generated at: 2026-08-17T21:43:15Z

---

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