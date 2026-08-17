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

## Coder Attempt #4 — T090

**Situation** : cycle infini détecté. Le workflow tourne en boucle depuis la tentative #1. Aucun code ne reste à écrire.

---

### Diagnostic du cycle

Le reviewer émet correctement `IMPLEMENTATION_FIX_REQUIRED` **mais pas pour un bug de code** — pour une porte de validation humaine que seul Pierre peut franchir. `run_ticket.py` interprète ce statut comme "relancer le coder", ce qui crée une boucle infinie :

```
Reviewer → IMPLEMENTATION_FIX_REQUIRED (porte humaine manquante)
  └→ run_ticket.py → relance le Coder
       └→ Coder → rien à coder, signale la porte humaine
            └→ Reviewer → IMPLEMENTATION_FIX_REQUIRED (porte humaine manquante)
                 └→ (boucle)
```

### État du code

Complet et correct depuis la tentative #1. Vérifié indépendamment 3 fois :

| Couche | État |
|---|---|
| `media-prober.ts` — ffprobe duration extraction | ✓ |
| `api-contracts/playback.ts` — `durationSeconds: number \| null` | ✓ |
| `playback-resolver.ts` — logs avec `durationSeconds` | ✓ |
| `usePlayback.ts` — `probeDurationSeconds` | ✓ |
| `PlayerPage.tsx` — lock/reset sur hint | ✓ |
| `PlayerControls.tsx` — lock on first valid durationchange, 2 couches visuelles, état indéterminé | ✓ |
| `useProgressSync.ts` — 4 chemins stable duration | ✓ |
| Tests — 337 passent, incluant `stableDurationSeconds=7200 > video.duration=3600` | ✓ |

**Aucune modification de code n'est effectuée dans cette tentative #4.**

---

### Action requise — Pierre uniquement

Le ticket a une **completion rule explicite non-délégable** :

> *"Do not close from mocked `duration=3600` tests alone. Demonstrate on a real stream that total duration is stable while buffering continues and that resume returns to the correct position after closing/reopening."*

Pour débloquer le workflow, Pierre doit :

1. Lancer l'app avec un vrai film Xtream long (≥ 60 min)
2. Vérifier que la barre de progression n'augmente pas en total pendant le buffering
3. Fermer à ~25%, rouvrir, confirmer que la position de reprise est correcte
4. Créer `runs/T090/evidence-real-stream.md` avec un log excerpt ou screenshot
5. Relancer la review

**Alternativement**, si Pierre juge le ticket clôturable sur la base des tests automatiques seuls, il peut modifier manuellement `runs/T090/state.json` pour passer en `APPROVED` et bypasser la completion rule.

---

**Aucun fichier modifié.** Le workflow est bloqué sur une porte de validation humaine — ce n'est pas un problème de code.

---

## Review

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

---

## Instructions de fix

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