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

## Summary

**Coder attempt #3 — T090**

**No code bug existed.** The reviewer confirmed the implementation is correct and complete. The `IMPLEMENTATION_FIX_REQUIRED` was issued solely because of a missing human validation artifact.

**What I did:**
- Applied the one minor fix that was actionable in code: added `durationSeconds` to both probe_result log entries in `playback-resolver.ts:252,266` (cache and fresh branches). This makes duration diagnostics visible in server logs — previously the field was propagated correctly through the entire chain but was invisible in logs.
- All 337 tests still pass.

**What remains — human gate (cannot be resolved in code):**

The ticket's explicit completion rule requires a human to:
1. Launch the app against a real Xtream movie
2. Confirm the seek bar total width does not grow while buffering
3. Close at ~25% (e.g. 1800s of a 7200s film), reopen, and verify the resume dialog appears at the correct position
4. Deposit screenshots or log excerpts in `runs/T090/`

This is a human validation step. The code is complete and correct.

---

## Review

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

---

## Instructions de fix

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