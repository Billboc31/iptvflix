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

`useProgressSync.test.ts` ran 7 tests (was 6 before the new test), all passing.

Here's a summary of what was done:

## Changes made

### Fix: `apps/web/src/pages/PlayerPage.tsx` (lines 83-88)

Added the `status === 'loading'` branch to reset `stableDurationSeconds` to `null` when a variant switch begins:

```ts
useEffect(() => {
  if (status === 'loading') {
    setStableDurationSeconds(null)   // ← new: clears stale duration on variant switch
  } else if (status === 'ready') {
    setStableDurationSeconds(probeDurationSeconds)
  }
}, [status, probeDurationSeconds])
```

**Why this fixes the bug**: When `PlayerControls` unmounts (status `'loading'`) and re-mounts (status `'ready'`), it would receive the old variant's duration as `hintDurationSeconds` and immediately lock on it — before the `setStableDurationSeconds(probeDurationSeconds)` effect had a chance to run. Now `stableDurationSeconds` is `null` by the time `PlayerControls` mounts for the new variant, so no stale lock occurs.

### New test: `apps/web/src/hooks/useProgressSync.test.ts`

Added a test verifying that `stableDurationSeconds=7200` takes priority over `video.duration=3600` when persisting progress — covering the core behavior of the ticket.

---

**Remaining open item (BLOQUANT 2)**: The real-stream validation required by the ticket's completion rule ("Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position") must be done manually by running the app against a real Xtream movie. This cannot be satisfied in code — it requires a browser session with an actual stream.

---

## Review

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

---

## Instructions de fix

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