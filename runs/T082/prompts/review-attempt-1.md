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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

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

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
