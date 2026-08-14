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


# T080 — Diagnose production Safari/iOS playback failure after compatibility fallback

**Source**: GitHub Issue #170

## Description

## Context
Playback now reaches the player and the Safari/iOS compatibility fallback from T079/#167 executes, but production iPhone Safari still ends with `Impossible de lire ce contenu sur ce navigateur`.

The previous ticket's test report explicitly could not verify the real iPhone/Safari production criterion. This ticket is DIAGNOSTIC ONLY: identify the exact failure in the real production playback path before changing strategy again.

## Goal
Produce a conclusive root-cause diagnosis for one or more real failing imported Xtream Movie/Episode streams on production-like Railway + iPhone Safari.

Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis that directly determines the correction ticket.

## Required investigation

### 1. Trace one real playback session end-to-end
For a failing real availability, correlate:
- canonical media id/type;
- availability id;
- source id;
- provider item id;
- stored container extension;
- playback session id;
- original gateway URL;
- compatibility gateway path/mode;
- browser/user agent category.

Never log provider credentials/full secret-bearing Xtream URLs.

### 2. Probe actual upstream media
Run/record ffprobe-equivalent metadata for the real selected upstream stream:
- actual container;
- video codec;
- codec profile/level/pixel format;
- resolution/frame rate;
- audio codec/channels/sample rate;
- duration if VOD;
- whether the upstream response is actually valid media rather than HTML/error/redirect.

### 3. Record compatibility decision
For the failing stream, log which mode `classifyDelivery()` chooses and WHY:
- DIRECT;
- proxy/pass-through;
- REMUX;
- TRANSCODE_AUDIO;
- TRANSCODE_VIDEO;
- other implemented mode.

Include the sanitized probe inputs that produced that decision.

### 4. Inspect ffmpeg execution
When fallback uses ffmpeg/remux/transcode, capture sanitized diagnostics:
- exact mode;
- sanitized ffmpeg arguments (input secret removed/masked);
- process spawn success/failure;
- exit code/signal;
- relevant stderr tail;
- time until first output bytes;
- whether ffmpeg remains alive until client disconnect;
- whether Railway kills it for resource/runtime reasons.

### 5. Validate HTTP response delivered to Safari
For BOTH original gateway and compat gateway, inspect:
- HTTP status;
- Content-Type;
- Content-Length / chunked transfer behavior;
- Accept-Ranges / Content-Range behavior;
- caching headers where relevant;
- first bytes/signature of output;
- whether response terminates prematurely;
- whether redirects occur;
- whether browser receives fMP4/MP4/HLS/TS/etc. matching the advertised MIME type.

### 6. Validate generated media outside the app
Take the compat output for the same real stream and determine whether it is independently playable/valid using suitable media inspection/player tooling. This distinguishes frontend integration failure from invalid gateway output.

### 7. Safari-specific evidence
Capture browser media error details available from the video element:
- MediaError code;
- readyState/networkState;
- source URL mode (normal vs compat);
- relevant events (`loadedmetadata`, `canplay`, `stalled`, `error`, etc.).

Add temporary safe diagnostic telemetry if necessary, but do not expose secrets.

### 8. Check deployment prerequisites
Verify in the ACTUAL Railway API deployment:
- ffmpeg exists;
- ffprobe exists;
- expected versions;
- nixpacks/build config is actually used;
- CPU/RAM/disk/temp-dir constraints;
- no missing executable/path/config mismatch between tests and production.

### 9. Test more than one representative stream
At minimum diagnose:
- the currently failing real iPhone case;
- one known/simple MP4 H.264/AAC availability if present;
- one availability requiring compat/remux if present.

This will reveal whether failure is universal or format-specific.

## Deliverable
Commit a diagnostic report under the ticket run artifacts containing:
- exact failing stage;
- observed upstream media metadata;
- selected compatibility mode;
- observed gateway/ffmpeg behavior;
- Safari-visible error;
- root cause;
- recommended correction with concrete code/components involved.

Do NOT implement a broad speculative fix in this ticket unless a tiny instrumentation fix is required to obtain evidence.

## Acceptance criteria
- [ ] A real production-like failing iPhone/Safari stream has been traced end-to-end.
- [ ] Actual upstream container/codecs are known.
- [ ] Actual compatibility mode selected is known and justified.
- [ ] ffmpeg/remux/transcode execution result is known when used.
- [ ] Actual HTTP/MIME/output delivered by compat gateway is known.
- [ ] It is known whether generated compat output is itself valid media.
- [ ] Safari media error/event evidence is captured.
- [ ] Railway ffmpeg/ffprobe deployment is verified, not assumed.
- [ ] Root cause is stated unambiguously with evidence.
- [ ] A concrete correction plan exists for the follow-up issue.
- [ ] Ticket is NOT marked complete merely because automated compatibility unit tests pass.

## Related
Follow-up to #167 / T079. The correction should be implemented in a separate ticket based on this diagnosis.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

The TypeScript error is pre-existing in an unrelated test file (`authenticateDevice.test.ts`) — not caused by my changes. The `playback.ts` modification itself is type-safe (same `DeliveryMode` type, same `runFfmpegStream` signature).

Here's what was done:

---

## Changes applied

### `apps/api/src/routes/playback.ts` (lines 423–453)

Replaced the legacy inline ffmpeg spawn block (which silently discarded all stderr) with a call to `runFfmpegStream('REMUX', ...)`. The legacy path now emits the same structured log fields as the compat path:
- `ffmpegPid`, `ffmpegArgs` (sanitized) at spawn
- `ffmpegExitCode`, `ffmpegExitSignal`, `ffmpegStderrTail` at close
- `msToFirstByte` on first output chunk
- `ffmpegAliveAtDisconnect` on client disconnect
- `legacyExtPath: true` on all lines so this path is distinguishable in Railway logs

This closes the coverage gap where probe failure → extension-based routing → silent ffmpeg failure was invisible.

### `runs/T080/diagnosis.md`

- Updated status line to reflect the code fix
- Added **Security Limitation** note in Section 8 documenting that `GET /api/diagnostics/env` is unauthenticated on Railway, acceptable as temporary, must be removed in the correction ticket

---

## Remaining blocker (human action required)

**Blocking 1** (production evidence) cannot be resolved by code changes. It requires:
1. Deploying this branch to Railway
2. Calling `/api/diagnostics/env` to verify ffmpeg/ffprobe presence
3. Playing a failing stream on a real iPhone Safari with Railway log stream open
4. Capturing Web Inspector console output
5. Filling the `<PENDING>` fields in `runs/T080/diagnosis.md` Sections 1–8

This is a manual step that gates the ticket's acceptance criteria. The instrumentation is now fully in place to collect that evidence.

---

## Review

I now have a complete picture of both cycles. Let me write the review.

---

# PR Review — T080 (Attempt 2)

## Résumé

Le coder-attempt-2 a traité les deux bloquants de la première review :
- **Bloquant 2 résolu** : le legacy extension path (`playback.ts:424-453`) appelle désormais `runFfmpegStream('REMUX', ...)` au lieu de spawner ffmpeg avec stderr silencieux.
- **Non-bloquant résolu** : la "Security Limitation" de la route `/api/diagnostics/env` est documentée dans `diagnosis.md` Section 8.

**Bloquant 1 toujours présent** : `diagnosis.md` contient zéro evidence de production. Toutes les sections 1–8 restent à `<PENDING>`. La cause racine n'est pas énoncée. Aucun critère d'acceptance exigeant de l'evidence réelle n'est satisfait. Le coder reconnaît explicitement que ce blocker "cannot be resolved by code changes" et "requires human action".

---

## Vérifications effectuées

- Lecture complète de `runs/T080/diagnosis.md` (version mise à jour)
- Lecture complète de `apps/api/src/routes/playback.ts` (version mise à jour)
- Lecture complète de `apps/api/src/routes/diagnostics.ts`
- Lecture de `runs/T080/implementation-output.md` (changelog coder-attempt-2)
- Vérification de la conformité aux critères d'acceptance du ticket

---

## Points validés dans coder-attempt-2

**Legacy ext path — Bloquant 2 corrigé (lignes 424-453)**

La refonte est propre :
```typescript
const outputStream = await runFfmpegStream(
  streamBody,
  'REMUX',
  { ...logCtx, legacyExtPath: true },
  app,
  (cb) => request.raw.on('close', cb),
)
```
Le tag `legacyExtPath: true` distingue ce chemin en Railway logs. Logging identique au compat path : pid, args sanitisés, exit code/signal, stderr tail, msToFirstByte, disconnect. Bloquant 2 est entièrement résolu.

**Section 8 diagnosis.md — Non-bloquant résolu**

Le paragraphe "Security Limitation — Unauthenticated diagnostics route" est présent, factuel, et mentionne explicitement que la route doit être supprimée dans le ticket correctif.

**Qualité générale du code — confirmée inchangée**

- `runFfmpegStream()` : correct. Sanitisation args, capture stderr, exit log, msToFirstByte, SIGKILL sur disconnect.
- Peek `tee()` (lignes 312-323) : correct. Les deux branches `tee()` reçoivent bien tous les bytes (comportement WHATWG spec). `reader.cancel()` n'annule pas `mainStream`. Fallback `catch {}` si `tee()` indisponible.
- `diagnostics.ts` : `execFile` (pas `exec`), timeout 10s sur chaque subprocess, guard `RAILWAY_ENVIRONMENT`. Correct.
- `logCtx` corrélé sur toutes les lignes de log dans les deux chemins.

---

## Problèmes détectés

### Bloquant 1 — Aucune evidence de production collectée (inchangé)

Les critères d'acceptance suivants du ticket ne sont **pas** satisfaits :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known from ffprobe | ❌ `<PENDING>` |
| Actual compatibility mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| Actual HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe verified (not assumed) | ❌ `<PENDING>` |
| Root cause stated unambiguously with evidence | ❌ Candidates ranked, not confirmed |

Le ticket stipule explicitement : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

Le `diagnosis.md` actuel est un template de collecte, pas un rapport de diagnostic. La Section 9 liste des hypothèses candidates — valeur analytique réelle — mais ce ne sont pas des causes racines confirmées par evidence.

### Observation structurelle — Ce bloquant est opérationnel, pas un problème de code

Le coder-attempt-2 reconnaît explicitement l'impossibilité de résoudre ce bloquant sans accès humain. La collecte d'evidence nécessite :
1. Déploiement de la branche sur Railway
2. Appel à `GET /api/diagnostics/env` pour vérifier ffmpeg/ffprobe
3. Session Safari réelle sur iPhone avec Railway log stream ouvert
4. Capture des logs Web Inspector
5. Remplissage des sections PENDING du rapport

Ces cinq étapes sont des opérations humaines/opérateur. Un cycle AI supplémentaire ne peut pas les exécuter.

---

## Décision

Les critères d'acceptance du ticket sont non satisfaits pour des raisons opérationnelles (pas de défaut de code). L'instrumentation est complète et correcte. Le ticket est bloqué sur une action humaine, pas sur une action AI.

**IMPLEMENTATION_FIX_REQUIRED**

---

## Actions demandées

### Obligatoire (bloquant — action humaine requise)

**Déployer sur Railway et collecter l'evidence** :

1. Merger ou déployer la branche `ticket/T080-diagnose-production-safari-ios-playback-failure-af` sur Railway
2. Appeler `GET /api/diagnostics/env` → vérifier `ffmpegPresent`, `ffmpegVersion`, `ffprobePresent`, `railwayPath`
3. Ouvrir Railway log stream (`railway logs -t --service api`)
4. Naviguer vers un Xtream Movie/Episode défaillant sur iPhone Safari avec Safari Web Inspector connecté
5. Capturer : logs Railway (sessionId, deliveryMode, upstreamFirstBytesHex, ffmpegExitCode, ffmpegStderrTail), Web Inspector console.warn (errorCode, readyState, networkState, urlMode, eventSequence)
6. Remplir les sections 1–8 de `runs/T080/diagnosis.md` avec les valeurs observées
7. Rédiger la Section 9 comme une **cause racine unique non-ambiguë**, de type : *"ffmpeg est absent du PATH Railway" ou "classifyDelivery retourne DIRECT pour un flux TS que Safari ne peut pas décoder"*, avec l'evidence à l'appui

**Ce sont les seules actions qui permettent de satisfaire les critères d'acceptance du ticket.**

### Recommandation process

Étant donné que ce bloquant ne peut pas être résolu par un agent AI seul, il est recommandé de :
- Escalader cette étape à l'opérateur/propriétaire du projet pour exécution manuelle
- Une fois l'evidence collectée, mettre à jour `diagnosis.md` et rouvrir la review
- Alternativement, si un accès Railway automatisé est disponible dans le pipeline, configurer un agent avec cet accès

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T16:21:27Z

---

I now have a complete picture of both cycles. Let me write the review.

---

# PR Review — T080 (Attempt 2)

## Résumé

Le coder-attempt-2 a traité les deux bloquants de la première review :
- **Bloquant 2 résolu** : le legacy extension path (`playback.ts:424-453`) appelle désormais `runFfmpegStream('REMUX', ...)` au lieu de spawner ffmpeg avec stderr silencieux.
- **Non-bloquant résolu** : la "Security Limitation" de la route `/api/diagnostics/env` est documentée dans `diagnosis.md` Section 8.

**Bloquant 1 toujours présent** : `diagnosis.md` contient zéro evidence de production. Toutes les sections 1–8 restent à `<PENDING>`. La cause racine n'est pas énoncée. Aucun critère d'acceptance exigeant de l'evidence réelle n'est satisfait. Le coder reconnaît explicitement que ce blocker "cannot be resolved by code changes" et "requires human action".

---

## Vérifications effectuées

- Lecture complète de `runs/T080/diagnosis.md` (version mise à jour)
- Lecture complète de `apps/api/src/routes/playback.ts` (version mise à jour)
- Lecture complète de `apps/api/src/routes/diagnostics.ts`
- Lecture de `runs/T080/implementation-output.md` (changelog coder-attempt-2)
- Vérification de la conformité aux critères d'acceptance du ticket

---

## Points validés dans coder-attempt-2

**Legacy ext path — Bloquant 2 corrigé (lignes 424-453)**

La refonte est propre :
```typescript
const outputStream = await runFfmpegStream(
  streamBody,
  'REMUX',
  { ...logCtx, legacyExtPath: true },
  app,
  (cb) => request.raw.on('close', cb),
)
```
Le tag `legacyExtPath: true` distingue ce chemin en Railway logs. Logging identique au compat path : pid, args sanitisés, exit code/signal, stderr tail, msToFirstByte, disconnect. Bloquant 2 est entièrement résolu.

**Section 8 diagnosis.md — Non-bloquant résolu**

Le paragraphe "Security Limitation — Unauthenticated diagnostics route" est présent, factuel, et mentionne explicitement que la route doit être supprimée dans le ticket correctif.

**Qualité générale du code — confirmée inchangée**

- `runFfmpegStream()` : correct. Sanitisation args, capture stderr, exit log, msToFirstByte, SIGKILL sur disconnect.
- Peek `tee()` (lignes 312-323) : correct. Les deux branches `tee()` reçoivent bien tous les bytes (comportement WHATWG spec). `reader.cancel()` n'annule pas `mainStream`. Fallback `catch {}` si `tee()` indisponible.
- `diagnostics.ts` : `execFile` (pas `exec`), timeout 10s sur chaque subprocess, guard `RAILWAY_ENVIRONMENT`. Correct.
- `logCtx` corrélé sur toutes les lignes de log dans les deux chemins.

---

## Problèmes détectés

### Bloquant 1 — Aucune evidence de production collectée (inchangé)

Les critères d'acceptance suivants du ticket ne sont **pas** satisfaits :

| Critère | État |
|---|---|
| Real failing iPhone/Safari stream traced end-to-end | ❌ `<PENDING>` |
| Actual upstream container/codecs known from ffprobe | ❌ `<PENDING>` |
| Actual compatibility mode selected and justified | ❌ `<PENDING>` |
| ffmpeg/remux execution result known | ❌ `<PENDING>` |
| Actual HTTP/MIME/output delivered to Safari known | ❌ `<PENDING>` |
| Generated compat output independently validated | ❌ `<PENDING>` |
| Safari MediaError/event evidence captured | ❌ `<PENDING>` |
| Railway ffmpeg/ffprobe verified (not assumed) | ❌ `<PENDING>` |
| Root cause stated unambiguously with evidence | ❌ Candidates ranked, not confirmed |

Le ticket stipule explicitement : *"Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."*

Le `diagnosis.md` actuel est un template de collecte, pas un rapport de diagnostic. La Section 9 liste des hypothèses candidates — valeur analytique réelle — mais ce ne sont pas des causes racines confirmées par evidence.

### Observation structurelle — Ce bloquant est opérationnel, pas un problème de code

Le coder-attempt-2 reconnaît explicitement l'impossibilité de résoudre ce bloquant sans accès humain. La collecte d'evidence nécessite :
1. Déploiement de la branche sur Railway
2. Appel à `GET /api/diagnostics/env` pour vérifier ffmpeg/ffprobe
3. Session Safari réelle sur iPhone avec Railway log stream ouvert
4. Capture des logs Web Inspector
5. Remplissage des sections PENDING du rapport

Ces cinq étapes sont des opérations humaines/opérateur. Un cycle AI supplémentaire ne peut pas les exécuter.

---

## Décision

Les critères d'acceptance du ticket sont non satisfaits pour des raisons opérationnelles (pas de défaut de code). L'instrumentation est complète et correcte. Le ticket est bloqué sur une action humaine, pas sur une action AI.

**IMPLEMENTATION_FIX_REQUIRED**

---

## Actions demandées

### Obligatoire (bloquant — action humaine requise)

**Déployer sur Railway et collecter l'evidence** :

1. Merger ou déployer la branche `ticket/T080-diagnose-production-safari-ios-playback-failure-af` sur Railway
2. Appeler `GET /api/diagnostics/env` → vérifier `ffmpegPresent`, `ffmpegVersion`, `ffprobePresent`, `railwayPath`
3. Ouvrir Railway log stream (`railway logs -t --service api`)
4. Naviguer vers un Xtream Movie/Episode défaillant sur iPhone Safari avec Safari Web Inspector connecté
5. Capturer : logs Railway (sessionId, deliveryMode, upstreamFirstBytesHex, ffmpegExitCode, ffmpegStderrTail), Web Inspector console.warn (errorCode, readyState, networkState, urlMode, eventSequence)
6. Remplir les sections 1–8 de `runs/T080/diagnosis.md` avec les valeurs observées
7. Rédiger la Section 9 comme une **cause racine unique non-ambiguë**, de type : *"ffmpeg est absent du PATH Railway" ou "classifyDelivery retourne DIRECT pour un flux TS que Safari ne peut pas décoder"*, avec l'evidence à l'appui

**Ce sont les seules actions qui permettent de satisfaire les critères d'acceptance du ticket.**

### Recommandation process

Étant donné que ce bloquant ne peut pas être résolu par un agent AI seul, il est recommandé de :
- Escalader cette étape à l'opérateur/propriétaire du projet pour exécution manuelle
- Une fois l'evidence collectée, mettre à jour `diagnosis.md` et rouvrir la review
- Alternativement, si un accès Railway automatisé est disponible dans le pipeline, configurer un agent avec cet accès

---

IMPLEMENTATION_FIX_REQUIRED