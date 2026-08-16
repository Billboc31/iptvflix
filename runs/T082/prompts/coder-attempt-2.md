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


# T082 — Diagnose and fix cross-platform web playback by standardizing browser delivery

**Source**: GitHub Issue #174

## Description

## Context
Playback still fails after the Safari/iOS-specific compatibility work, and the same problem is now confirmed on Android/mobile browsers too.

This means the remaining bug is likely NOT Safari-specific. The shared browser delivery pipeline is suspect: provider URL correctness, gateway output, MIME/headers, remux/transcode output, stream truncation, HLS/fMP4 generation, or frontend consumption.

The current system should stop being treated as fixed until a real Xtream Movie and Episode play successfully on both iPhone Safari and Android Chrome in production-like conditions.

## Goal
Diagnose the shared playback failure and converge on a deterministic browser-compatible delivery strategy for Xtream VOD.

Preferred architecture:

```text
Xtream VOD
   ↓
IPTVFlix backend
   ↓
probe actual media
   ↓
if proven browser-native
   → cheap proxy/pass-through
else
   → ffmpeg remux/transcode
   → standards-compliant HLS/fMP4 delivery
   ↓
Safari / Chrome / Android browser
```

The player should not receive arbitrary provider formats and hope the browser decodes them.

## Phase 1 — Cross-platform diagnosis
Trace at least one real failing Movie and one real failing Episode end-to-end.

Capture safely:
- canonical media id/type;
- availability id;
- source id;
- provider item id;
- stored extension;
- actual ffprobe container/codecs;
- selected delivery mode;
- gateway endpoint used;
- HTTP status;
- Content-Type;
- Range/Content-Range behavior;
- first output bytes/container signature;
- ffmpeg spawn/exit/stderr/time-to-first-byte when used;
- whether output terminates unexpectedly;
- browser media error code/networkState/readyState.

Never log Xtream credentials or full credential-bearing URLs.

Verify the final IPTVFlix output independently with ffprobe/ffplay/VLC or equivalent. Determine whether the backend itself outputs invalid media or whether only the browser integration fails.

## Phase 2 — Standardize browser delivery
Based on diagnosis, implement a robust browser delivery policy.

### Native fast path
Only use simple pass-through/proxy when media is proven browser-compatible for supported targets and HTTP semantics are correct.

Typical safe examples may include appropriate MP4/H.264/AAC or already-valid HLS, but capability must be based on actual probe data rather than filename alone.

### Canonical compatibility path
For everything else, prefer a standards-compliant HLS pipeline suitable for modern Safari and Chromium-based mobile browsers.

Use ffmpeg as needed to:
- remux when codecs are already compatible;
- transcode audio only when necessary;
- transcode video only when truly necessary;
- emit valid HLS playlist(s) and segments (TS or fMP4 according to chosen implementation);
- begin playback progressively without waiting for the whole VOD;
- clean temporary/session artifacts;
- handle disconnects and process cleanup;
- bound CPU, RAM and disk usage.

Do not send raw MKV/odd TS/unsupported container output directly to browser video elements and call it supported.

## HLS gateway requirements
If HLS is selected as the compatibility path, IPTVFlix must expose browser-safe application URLs such as conceptually:

```text
/playback/session/:id/master.m3u8
/playback/session/:id/segments/...
```

Requirements:
- playlist URLs resolve correctly behind Railway HTTPS;
- segment URLs remain authenticated/session-scoped as appropriate;
- correct HLS MIME types;
- no provider credentials exposed;
- no mixed-content HTTP provider URLs leak into playlists;
- playlist/segment proxying works through IPTVFlix;
- cleanup on expiry;
- no unbounded segment accumulation.

## Frontend player
Use one shared Movie/Episode playback flow.

For HLS:
- Safari/iOS may use native HLS support;
- Chromium/Android should use the existing supported HLS strategy/library if native support is insufficient;
- do not create separate product behavior per platform beyond player capability handling.

`Regarder` should result in playback automatically. No technical compatibility selector should be exposed to users.

## Variant strategy
Before expensive transcoding, the resolver may choose another equivalent compatible variant when appropriate (same content and language, acceptable quality), e.g. prefer 1080p H.264 over a problematic 4K codec when that improves browser compatibility.

Do not silently change language.

## Railway readiness
Verify in the actual Railway runtime:
- ffmpeg and ffprobe are installed and executable;
- build configuration used by Railway really contains those dependencies;
- temp directory is writable;
- process execution works in deployment;
- resource limits are observable;
- no deployment-local assumption differs from tests.

## Observability
Add sanitized playback diagnostics sufficient to answer for every session:
- selected availability;
- actual media probe result;
- selected delivery strategy;
- ffmpeg mode/status;
- HLS session creation/status;
- upstream/result category;
- client error category.

No credential leakage.

## Required real-device validation
Automated tests alone are NOT sufficient.

At minimum manually validate after production deployment:
1. one real Movie on iPhone Safari;
2. one real Movie on Android Chrome;
3. one real Episode on at least one mobile browser;
4. one browser-native/simple stream to verify fast-path regression;
5. one stream requiring remux/transcode/HLS.

If autonomous testing cannot validate real devices, the ticket must remain `awaiting manual playback validation` rather than being reported fully fixed.

## Acceptance criteria
- [ ] Root cause of the current cross-platform failure is documented with evidence.
- [ ] The final IPTVFlix media output for a failing stream is independently validated.
- [ ] Browser delivery no longer depends on arbitrary Xtream raw container compatibility.
- [ ] Compatible native media keeps a cheap proxy/pass-through path.
- [ ] Incompatible media uses a deterministic browser-compatible path, preferably HLS when appropriate.
- [ ] HLS playlists and segments are valid and served with correct MIME/HTTPS URLs.
- [ ] No provider credentials appear in playlist URLs, browser-visible media URLs, or logs.
- [ ] ffmpeg/ffprobe work in the actual Railway runtime.
- [ ] Movie playback works on real iPhone Safari.
- [ ] Movie playback works on real Android Chrome.
- [ ] Episode playback works through the same pipeline.
- [ ] Retry creates a fresh valid playback attempt rather than replaying a known-broken target.
- [ ] Resource/process/session cleanup is implemented.
- [ ] Automated tests cover pass-through, HLS/remux/transcode, gateway headers, playlist/segment serving, failures and credential safety.
- [ ] Real-device checks are treated as blocking manual acceptance when they cannot be automated.

## Related
This supersedes the assumption that the remaining issue is Safari-only. It follows the previous playback URL, gateway and Safari-compatibility work and should reuse any sound pieces rather than layering another platform-specific workaround.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

All tasks complete. Here's the summary of what was implemented:

---

## Summary

**Files modified:**

| File | Change |
|---|---|
| `packages/api-contracts/src/playback.ts` | Added `DeliveryMode`, `PlaybackProbeResult`, `deliveryMode`, `probeResult` fields; removed `compatGatewayUrl` |
| `apps/api/src/services/playback-compat.ts` | Removed `isSafariOrIOS()`; updated `classifyDelivery()` to browser-agnostic 4-mode logic; updated `buildFfmpegArgs()` to emit HLS output with `tempDir` param |
| `apps/api/src/services/playback-session-store.ts` | Added `deliveryMode: DeliveryMode` to `SessionEntry` |
| `apps/api/src/services/playback-resolver.ts` | Added probe-at-resolve-time; `classifyDelivery()` determines mode; HLS sessions spawn ffmpeg pipeline; returns `deliveryMode` + `probeResult`; extension fallback on probe failure |
| `apps/api/src/routes/playback.ts` | Simplified `/stream/:id` to DIRECT-only (409 for HLS); added `/session/:id/master.m3u8` and `/session/:id/segments/:filename` HLS endpoints; removed compat path + extension routing |
| `apps/api/src/services/availability-resolver.ts` | Added `codecCompatibilityScore()` as lowest-priority tiebreaker (H.264→0, HEVC→1, VP9/AV1→2); added `videoCodec?` to `ResolvableVariant` |
| `apps/web/src/hooks/usePlayback.ts` | Replaced `compatUrl` with `deliveryMode`; removed compat state |
| `apps/web/src/pages/PlayerPage.tsx` | Unified Movie/Episode playback; removed compat fallback retry; HLS detection based on `deliveryMode` |
| `apps/api/src/index.ts` | Added startup checks: `ffmpeg -version`, `ffprobe -version`, tmpdir write test; exits with code 1 if any fail |

**Files created:**

| File | Purpose |
|---|---|
| `apps/api/src/services/hls-session-store.ts` | ffmpeg HLS session lifecycle: create/get session, playlist rewriting, segment path validation, TTL + background cleanup, segment accumulation limit |
| `apps/api/src/services/__tests__/hls-session-store.test.ts` | 13 tests covering SEGMENT_RE, session creation, playlist rewriting, segment validation, TTL/failure |
| `runs/T082/diagnosis.md` | Root cause documentation for cross-platform failure |

**Files deleted:**

- `apps/api/src/__tests__/playback-stream-compat.test.ts` — tests for the removed compat path

**Test results:** 119 playback-related tests pass; web typecheck clean; no new API typecheck errors introduced.

**Awaiting manual validation** before ticket closure (per plan): real device testing on iPhone Safari, Android Chrome, and Episode playback required.

---

## Review

## Résultat de la review

**Décision : `IMPLEMENTATION_FIX_REQUIRED`**

---

### Points validés

L'architecture centrale est correcte :
- Probe-first via `probeMedia()` + `classifyDelivery()` entièrement browser-agnostic
- HLS session store complet : TTL 2h, SIGKILL + rm -rf, accumulation limitée à 500 segments, path traversal double-défense
- Routes HLS correctes (409 sur `/stream/:id`, 404/410/200 sur `master.m3u8`, Content-Length sur segments)
- Startup checks Railway fonctionnels (ffmpeg/ffprobe + tmpdir)
- Frontend unifié sans sélecteur technique, hls.js attaché correctement pour Chrome
- Credential safety : aucun hostname/credentials provider dans les playlists
- Codec scoring préserve la langue

---

### Problèmes à corriger

**[BLOQUANT] Retry frontend cassé pour HLS sur Chrome** (`PlayerPage.tsx` lignes 231–246)

Le `onRetry` fait `video.src = gatewayUrl; video.load()` directement. Pour les sessions HLS, cela bypasse hls.js — le retry ne fonctionnera pas sur Chrome/Android. De plus, si la session est expirée (410), le retry rejoue l'URL cassée sans en créer une nouvelle.

Correction : appeler `switchVariant(availabilityId)` au lieu de manipuler `video.src`.

**[SIGNIFICATIF] `extensionFallbackMode('.mp4') → DIRECT` réintroduit la cause racine** (`playback-resolver.ts` lignes 84–90)

Sur échec du probe, un `.mp4` HEVC passe silencieusement en `DIRECT` — exactement le scénario diagnostiqué comme root cause. Le fallback sûr est `HLS_TRANSCODE_FULL` pour tout container ambigu.

**[MINEUR]** E2E test ne vérifie pas `deliveryMode` dans la réponse (prévu par le plan).

**[MINEUR]** ffmpeg exit code/stderrTail non logués dans le handler `proc.on('close')` (observabilité incomplète).

---

La review complète est dans `runs/T082/reviews/review-attempt-1.md`.

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T082/reviews/implementation-review.md
- generated at: 2026-08-16T09:40:08Z

---

## Résultat de la review

**Décision : `IMPLEMENTATION_FIX_REQUIRED`**

---

### Points validés

L'architecture centrale est correcte :
- Probe-first via `probeMedia()` + `classifyDelivery()` entièrement browser-agnostic
- HLS session store complet : TTL 2h, SIGKILL + rm -rf, accumulation limitée à 500 segments, path traversal double-défense
- Routes HLS correctes (409 sur `/stream/:id`, 404/410/200 sur `master.m3u8`, Content-Length sur segments)
- Startup checks Railway fonctionnels (ffmpeg/ffprobe + tmpdir)
- Frontend unifié sans sélecteur technique, hls.js attaché correctement pour Chrome
- Credential safety : aucun hostname/credentials provider dans les playlists
- Codec scoring préserve la langue

---

### Problèmes à corriger

**[BLOQUANT] Retry frontend cassé pour HLS sur Chrome** (`PlayerPage.tsx` lignes 231–246)

Le `onRetry` fait `video.src = gatewayUrl; video.load()` directement. Pour les sessions HLS, cela bypasse hls.js — le retry ne fonctionnera pas sur Chrome/Android. De plus, si la session est expirée (410), le retry rejoue l'URL cassée sans en créer une nouvelle.

Correction : appeler `switchVariant(availabilityId)` au lieu de manipuler `video.src`.

**[SIGNIFICATIF] `extensionFallbackMode('.mp4') → DIRECT` réintroduit la cause racine** (`playback-resolver.ts` lignes 84–90)

Sur échec du probe, un `.mp4` HEVC passe silencieusement en `DIRECT` — exactement le scénario diagnostiqué comme root cause. Le fallback sûr est `HLS_TRANSCODE_FULL` pour tout container ambigu.

**[MINEUR]** E2E test ne vérifie pas `deliveryMode` dans la réponse (prévu par le plan).

**[MINEUR]** ffmpeg exit code/stderrTail non logués dans le handler `proc.on('close')` (observabilité incomplète).

---

La review complète est dans `runs/T082/reviews/review-attempt-1.md`.

IMPLEMENTATION_FIX_REQUIRED