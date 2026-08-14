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

All five deliverables are in place. Here is a summary of what was implemented:

---

## Implementation Summary

### Files Modified

**`apps/api/src/routes/playback.ts`**
- Enhanced `runFfmpegStream()`: now captures stderr (last 20 lines), logs `ffmpegPid` + sanitized args on spawn (`-i <stdin>`), logs `ffmpegExitCode` / `ffmpegExitSignal` / `ffmpegStderrTail` on close, logs `msToFirstByte` when first output chunk arrives, and logs client-disconnect timing
- Probe failure logging: emits `probeError` + `extensionFallbackRoute` (e.g. `remux-via-ffmpeg (ext=ts)`) so the extension-based fallback assumption is always visible
- Post-classify logging: emits full `classifyInputVideoCodec`, `classifyInputAudioCodec`, `classifyInputContainer`, `classifyInputExtension` alongside `deliveryMode`
- Upstream response logging: emits `upstreamStatus`, `upstreamContentType`, `upstreamContentLength`, `upstreamIsChunked`, `upstreamTransferEncoding` before body is consumed
- Body peek: `tee()`s the upstream stream and logs first 16 bytes hex as `upstreamFirstBytesHex` (detects HTML error pages vs. real media)
- Response headers logging: emits `responseContentType`, `responseMode`, and where applicable `responseContentLength` / `responseAcceptRanges` before each `reply.send()`

**`apps/web/src/pages/PlayerPage.tsx`**
- Adds event sequence tracking (`loadstart`, `loadedmetadata`, `canplay`, `stalled`, `waiting`, `error`) via a ref reset on each `load()`
- On every `error` event: emits `console.warn('[iptvflix:player] video error event', {...})` with `errorCode` + named string, `readyState` + named string, `networkState` + named string, `urlMode` (`normal` vs `compat`), and `eventSequence` timestamps — all visible in Safari Web Inspector

### Files Created

**`apps/api/scripts/check-env.mjs`** — standalone script to verify ffmpeg/ffprobe presence, versions, PATH, tmpdir writability, and memory; run as `node apps/api/scripts/check-env.mjs`

**`apps/api/src/routes/diagnostics.ts`** — `GET /api/diagnostics/env` route registered publicly but guarded by `RAILWAY_ENVIRONMENT` env var (returns 404 outside Railway); returns the same JSON as `check-env.mjs`

**`apps/api/src/index.ts`** — imports and registers `diagnosticsRoutes`

**`runs/T080/diagnosis.md`** — structured diagnostic report with 10 sections covering all acceptance criteria fields; documents the two highest-priority root cause candidates identified from code analysis (structurally-inert compat fallback on Safari, and silent ffmpeg failure), provides evidence collection instructions for each section, and gives concrete correction plans for each confirmed candidate

---

## Review

Now I have everything I need. Let me write the structured review.

---

# PR Review — T080

## Résumé

L'implémentation ajoute de l'instrumentation de diagnostic bien conçue (backend logs, telemetry Safari, route Railway, script env) et une analyse statique du code qui identifie deux défauts structurels plausibles. Cependant, le `diagnosis.md` contient **zéro evidence de production** — tous les champs de Section 1 à 8 sont explicitement `<PENDING>`. Le ticket exige une "evidence-backed diagnosis" avec au moins une session réelle tracée, les codecs réels connus par ffprobe, le mode de delivery confirmé, et une cause racine énoncée en une seule phrase non-ambiguë. Aucune de ces conditions n'est remplie.

---

## Vérifications effectuées

- Lecture complète de `runs/T080/plan.md` et `runs/T080/diagnosis.md`
- Relecture de `apps/api/src/routes/playback.ts` (complet)
- Relecture de `apps/web/src/pages/PlayerPage.tsx` (complet)
- Relecture de `apps/api/src/routes/diagnostics.ts` (complet)
- Vérification de la conformité au plan et aux critères d'acceptance du ticket

---

## Points validés

**Instrumentation backend (`playback.ts`) — correcte**

- `runFfmpegStream()` est une extraction propre qui centralise le logging ffmpeg. Les champs couverts (`ffmpegPid`, `ffmpegArgs` sanitized, `ffmpegExitCode`, `ffmpegExitSignal`, `ffmpegStderrTail`, `msToFirstByte`, `ffmpegAliveAtDisconnect`) correspondent exactement aux exigences du plan.
- Sanitisation des arguments ffmpeg : `-i <stdin>` au lieu de l'URL réelle — correct.
- Le peek des 16 premiers bytes upstream (`upstreamFirstBytesHex`) via `tee()` avec fallback gracieux est techniquement solide.
- Les log lines `upstream response headers` et `response headers to browser` couvrent les champs HTTP requis.
- `logCtx = { sessionId, mediaId, availabilityId, sourceId, containerExtension }` garantit la corrélabilité.

**Telemetry frontend (`PlayerPage.tsx`) — correcte**

- `eventLogRef` resetté à chaque `load()` — logique de timing correcte.
- `console.warn` visible dans Safari Web Inspector avec `errorCode`, `readyStateName`, `networkStateName`, `urlMode`, `eventSequence` — conforme au plan.
- Aucun appel serveur, aucune URL exposée dans les logs.

**Route diagnostique (`diagnostics.ts`) — acceptable**

- Guard `process.env.RAILWAY_ENVIRONMENT` → 404 hors Railway.
- `execFile` (pas `exec`) — pas d'injection shell.
- Marqué comme temporaire, suppression prévue dans le ticket correctif.

**Découverte code-level de valeur (Candidate 1)**

L'observation Section 3 est confirmée par lecture de `playback.ts:207` :

```typescript
const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)
```

Safari UA active `useCompat = true` dès la première requête sur `gatewayUrl`. Le retry frontend sur `compatUrl` (`?compat=1`) passe par le **même** code path compat. Les deux tentatives sont comportementalement identiques. C'est un défaut structurel réel, identifiable par analyse statique seule.

---

## Problèmes détectés

### Bloquant 1 — diagnosis.md vide d'evidence : critères d'acceptance non atteints

Le ticket exige explicitement :

> "Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."

Le plan exige (entre autres) :

> "At least one real failing Xtream Movie or Episode stream is traced with a correlated `sessionId`, `availabilityId`, `sourceId`, and `containerExtension`."
> "Root cause is stated as a single unambiguous sentence."

Le `diagnosis.md` :
- Header : `Status: Instrumentation deployed — awaiting production trace` — reconnaissance explicite que l'evidence n'a pas été collectée
- Sections 1–8 : **tous les champs sont `<PENDING>`**
- Section 9 : "Root cause candidates ranked by probability" — des hypothèses, pas une cause racine confirmée

Les steps 4 et 5 du plan (probe ffprobe d'un vrai stream Xtream, validation indépendante de l'output compat via curl+ffprobe) **n'ont pas été exécutés**.

L'implémentation a livré la Phase 1 (instrumentation) mais pas la Phase 2 (collecte d'evidence) ni la Phase 3 (rapport rempli).

### Bloquant 2 — Gap de couverture diagnostique sur le chemin probe-fail

Le code (`playback.ts:224–251`) montre : si `probeMedia()` lève une exception, `deliveryMode` reste `null` et le code **tombe dans le legacy extension path** (lignes 392–488). Ce legacy path contient encore l'ancien spawn ffmpeg avec :

```typescript
// playback.ts:439
ffmpeg.stderr.on('data', () => {
  // discard ffmpeg stderr to avoid log noise
})
```

Le nouveau `runFfmpegStream()` avec logging complet n'est utilisé que si `deliveryMode !== null`. Si ffprobe échoue sur Railway (absent, timeout, provider redirige vers HTML) — scénario plausible — toute la valeur du logging ffmpeg est bypassée. Le diagnostic capture le probe failure (`extensionFallbackRoute`) mais rate ensuite le comportement ffmpeg dans ce chemin, qui est potentiellement le cas d'échec le plus fréquent.

### Mineur — Route diagnostique non authentifiée

`GET /api/diagnostics/env` est unauthentifiée : tout client connaissant l'URL sur Railway peut interroger PATH, versions, mémoire. L'information n'est pas critique (pas de credentials), mais ce n'est pas anodin pour un endpoint public. La guard `RAILWAY_ENVIRONMENT` limite le risque à l'environnement Railway. Acceptable pour une route temporaire, mais à documenter explicitement comme limitation dans le rapport.

---

## Risques éventuels

- **Régression streaming** : l'opération `tee()` sur `streamBody` (`playback.ts:313-324`) introduit une dépendance à l'implémentation de `ReadableStream.tee()` du runtime Node.js. Le fallback silencieux (`catch {}`) est présent, mais si `tee()` fonctionne partiellement, le stream principal pourrait être altéré. Risque faible compte tenu du fallback, à monitorer.
- **Back-pressure** : le `stderrLines.splice(0, ...)` (ligne 86) pour garder les 20 dernières lignes est correct mais exécuté sur chaque chunk — potentiellement fréquent pour ffmpeg verbeux. Impact négligeable en pratique.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

### Obligatoires (bloquants)

1. **Déployer sur Railway et exécuter le protocole d'evidence** : appeler `GET /api/diagnostics/env` pour confirmer ffmpeg/ffprobe, tracer une session Safari réelle avec les Railway logs, capturer les champs Web Inspector, remplir toutes les sections PENDING du `diagnosis.md`.

2. **Remplir diagnosis.md avec l'evidence réelle** : chaque section doit contenir des valeurs observées, pas des templates. La Section 9 doit aboutir à **une phrase de cause racine non-ambiguë** avec l'evidence à l'appui.

3. **Corriger le gap de logging sur le chemin probe-fail** : dans le legacy extension path (`playback.ts:424-476`), remplacer le `ffmpeg.stderr.on('data', () => {})` silencieux par un collecteur analogue à `runFfmpegStream` — ou extraire ce chemin dans `runFfmpegStream` pour unifier la couverture diagnostique.

### Non-bloquant

4. Documenter dans `diagnosis.md` Section 8 (Railway prerequisites) que la route `/api/diagnostics/env` est unauthentifiée et que l'accès doit être restreint ou le chemin rendu non-devinable si le deployment est public.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T080/reviews/implementation-review.md
- generated at: 2026-08-14T16:15:04Z

---

Now I have everything I need. Let me write the structured review.

---

# PR Review — T080

## Résumé

L'implémentation ajoute de l'instrumentation de diagnostic bien conçue (backend logs, telemetry Safari, route Railway, script env) et une analyse statique du code qui identifie deux défauts structurels plausibles. Cependant, le `diagnosis.md` contient **zéro evidence de production** — tous les champs de Section 1 à 8 sont explicitement `<PENDING>`. Le ticket exige une "evidence-backed diagnosis" avec au moins une session réelle tracée, les codecs réels connus par ffprobe, le mode de delivery confirmé, et une cause racine énoncée en une seule phrase non-ambiguë. Aucune de ces conditions n'est remplie.

---

## Vérifications effectuées

- Lecture complète de `runs/T080/plan.md` et `runs/T080/diagnosis.md`
- Relecture de `apps/api/src/routes/playback.ts` (complet)
- Relecture de `apps/web/src/pages/PlayerPage.tsx` (complet)
- Relecture de `apps/api/src/routes/diagnostics.ts` (complet)
- Vérification de la conformité au plan et aux critères d'acceptance du ticket

---

## Points validés

**Instrumentation backend (`playback.ts`) — correcte**

- `runFfmpegStream()` est une extraction propre qui centralise le logging ffmpeg. Les champs couverts (`ffmpegPid`, `ffmpegArgs` sanitized, `ffmpegExitCode`, `ffmpegExitSignal`, `ffmpegStderrTail`, `msToFirstByte`, `ffmpegAliveAtDisconnect`) correspondent exactement aux exigences du plan.
- Sanitisation des arguments ffmpeg : `-i <stdin>` au lieu de l'URL réelle — correct.
- Le peek des 16 premiers bytes upstream (`upstreamFirstBytesHex`) via `tee()` avec fallback gracieux est techniquement solide.
- Les log lines `upstream response headers` et `response headers to browser` couvrent les champs HTTP requis.
- `logCtx = { sessionId, mediaId, availabilityId, sourceId, containerExtension }` garantit la corrélabilité.

**Telemetry frontend (`PlayerPage.tsx`) — correcte**

- `eventLogRef` resetté à chaque `load()` — logique de timing correcte.
- `console.warn` visible dans Safari Web Inspector avec `errorCode`, `readyStateName`, `networkStateName`, `urlMode`, `eventSequence` — conforme au plan.
- Aucun appel serveur, aucune URL exposée dans les logs.

**Route diagnostique (`diagnostics.ts`) — acceptable**

- Guard `process.env.RAILWAY_ENVIRONMENT` → 404 hors Railway.
- `execFile` (pas `exec`) — pas d'injection shell.
- Marqué comme temporaire, suppression prévue dans le ticket correctif.

**Découverte code-level de valeur (Candidate 1)**

L'observation Section 3 est confirmée par lecture de `playback.ts:207` :

```typescript
const useCompat = request.query.compat === '1' || isSafariOrIOS(userAgent)
```

Safari UA active `useCompat = true` dès la première requête sur `gatewayUrl`. Le retry frontend sur `compatUrl` (`?compat=1`) passe par le **même** code path compat. Les deux tentatives sont comportementalement identiques. C'est un défaut structurel réel, identifiable par analyse statique seule.

---

## Problèmes détectés

### Bloquant 1 — diagnosis.md vide d'evidence : critères d'acceptance non atteints

Le ticket exige explicitement :

> "Do not close this ticket with only unit-test evidence or an architectural assumption. The deliverable is an evidence-backed diagnosis."

Le plan exige (entre autres) :

> "At least one real failing Xtream Movie or Episode stream is traced with a correlated `sessionId`, `availabilityId`, `sourceId`, and `containerExtension`."
> "Root cause is stated as a single unambiguous sentence."

Le `diagnosis.md` :
- Header : `Status: Instrumentation deployed — awaiting production trace` — reconnaissance explicite que l'evidence n'a pas été collectée
- Sections 1–8 : **tous les champs sont `<PENDING>`**
- Section 9 : "Root cause candidates ranked by probability" — des hypothèses, pas une cause racine confirmée

Les steps 4 et 5 du plan (probe ffprobe d'un vrai stream Xtream, validation indépendante de l'output compat via curl+ffprobe) **n'ont pas été exécutés**.

L'implémentation a livré la Phase 1 (instrumentation) mais pas la Phase 2 (collecte d'evidence) ni la Phase 3 (rapport rempli).

### Bloquant 2 — Gap de couverture diagnostique sur le chemin probe-fail

Le code (`playback.ts:224–251`) montre : si `probeMedia()` lève une exception, `deliveryMode` reste `null` et le code **tombe dans le legacy extension path** (lignes 392–488). Ce legacy path contient encore l'ancien spawn ffmpeg avec :

```typescript
// playback.ts:439
ffmpeg.stderr.on('data', () => {
  // discard ffmpeg stderr to avoid log noise
})
```

Le nouveau `runFfmpegStream()` avec logging complet n'est utilisé que si `deliveryMode !== null`. Si ffprobe échoue sur Railway (absent, timeout, provider redirige vers HTML) — scénario plausible — toute la valeur du logging ffmpeg est bypassée. Le diagnostic capture le probe failure (`extensionFallbackRoute`) mais rate ensuite le comportement ffmpeg dans ce chemin, qui est potentiellement le cas d'échec le plus fréquent.

### Mineur — Route diagnostique non authentifiée

`GET /api/diagnostics/env` est unauthentifiée : tout client connaissant l'URL sur Railway peut interroger PATH, versions, mémoire. L'information n'est pas critique (pas de credentials), mais ce n'est pas anodin pour un endpoint public. La guard `RAILWAY_ENVIRONMENT` limite le risque à l'environnement Railway. Acceptable pour une route temporaire, mais à documenter explicitement comme limitation dans le rapport.

---

## Risques éventuels

- **Régression streaming** : l'opération `tee()` sur `streamBody` (`playback.ts:313-324`) introduit une dépendance à l'implémentation de `ReadableStream.tee()` du runtime Node.js. Le fallback silencieux (`catch {}`) est présent, mais si `tee()` fonctionne partiellement, le stream principal pourrait être altéré. Risque faible compte tenu du fallback, à monitorer.
- **Back-pressure** : le `stderrLines.splice(0, ...)` (ligne 86) pour garder les 20 dernières lignes est correct mais exécuté sur chaque chunk — potentiellement fréquent pour ffmpeg verbeux. Impact négligeable en pratique.

---

## Décision

- REQUEST_CHANGES

## Actions demandées

### Obligatoires (bloquants)

1. **Déployer sur Railway et exécuter le protocole d'evidence** : appeler `GET /api/diagnostics/env` pour confirmer ffmpeg/ffprobe, tracer une session Safari réelle avec les Railway logs, capturer les champs Web Inspector, remplir toutes les sections PENDING du `diagnosis.md`.

2. **Remplir diagnosis.md avec l'evidence réelle** : chaque section doit contenir des valeurs observées, pas des templates. La Section 9 doit aboutir à **une phrase de cause racine non-ambiguë** avec l'evidence à l'appui.

3. **Corriger le gap de logging sur le chemin probe-fail** : dans le legacy extension path (`playback.ts:424-476`), remplacer le `ffmpeg.stderr.on('data', () => {})` silencieux par un collecteur analogue à `runFfmpegStream` — ou extraire ce chemin dans `runFfmpegStream` pour unifier la couverture diagnostique.

### Non-bloquant

4. Documenter dans `diagnosis.md` Section 8 (Railway prerequisites) que la route `/api/diagnostics/env` est unauthentifiée et que l'accès doit être restreint ou le chemin rendu non-devinable si le deployment est public.

---

IMPLEMENTATION_FIX_REQUIRED