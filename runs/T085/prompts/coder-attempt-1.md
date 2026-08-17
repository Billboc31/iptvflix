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


# T085 — Playback still broken: prove one real Xtream movie plays end-to-end before closing

**Source**: GitHub Issue #180

## Description

## Context
After multiple playback tickets and substantial code changes, IPTVFlix still does not actually play video on real devices. We have already tried direct Xtream URLs, compatibility detection, gateway/proxy logic, remux/transcode/HLS work, Safari-specific fixes, cross-platform fixes, and subsequent regression repairs.

The current problem is no longer "implement a plausible playback architecture". The problem is: **we still do not have proof that one real Xtream VOD stream can be played end-to-end through IPTVFlix.**

This ticket must therefore be evidence-driven. Stop guessing at browser compatibility and stop marking playback fixed from unit tests alone.

## Non-negotiable goal
Take ONE real movie availability from the configured Xtream source and follow it through every layer until actual moving video + audio is observed in the IPTVFlix WebApp.

The ticket is NOT complete until that golden-path stream plays, or until a concrete external/provider blocker is proven with reproducible evidence.

## Phase 1 — Establish a known-good source stream
Select one real movie that currently has an Xtream availability in the production/prod-like database.

For that exact availability, record sanitized values for:
- movie ID;
- availability ID;
- source ID;
- Xtream stream ID;
- container extension;
- quality/language metadata;
- generated upstream URL shape (credentials redacted).

Then test the upstream Xtream stream **outside IPTVFlix** from the API runtime/network environment.

Use tools such as `curl`, `ffprobe`, and `ffmpeg` to prove:
- HTTP status;
- redirects;
- Content-Type;
- Content-Length/chunked behavior;
- Range support if relevant;
- whether bytes actually arrive;
- detected container;
- video codec/profile/pixel format/resolution;
- audio codec/channels/sample rate;
- duration;
- whether ffmpeg can decode at least 10–30 seconds without fatal errors.

If the upstream URL is wrong, fix URL construction first. Do NOT continue debugging React/HLS against a broken source URL.

## Phase 2 — Verify Xtream URL semantics
Do not assume all VOD uses the same URL pattern.

Verify the provider's actual expected URL using the source metadata/API responses. Check movie vs series URL construction and `container_extension` handling. Confirm whether the expected VOD URL is equivalent to:

`/movie/{username}/{password}/{streamId}.{ext}`

or another provider-specific form.

Also verify that no code is accidentally using live-TV URL semantics for VOD.

Add a focused automated test using the exact URL semantics discovered.

## Phase 3 — Trace the exact IPTVFlix playback request
Starting from the UI `Regarder` click, log/trace a correlation ID through:

```text
Regarder
  -> selected availability
  -> playback resolve API
  -> upstream URL construction
  -> probe/classification
  -> DIRECT / REMUX / TRANSCODE decision
  -> gateway/session creation
  -> manifest/media request
  -> browser player
```

For the golden-path movie, produce a concise trace showing what happened at every step.

The trace must make obvious where playback stops.

Do not log Xtream usernames/passwords/tokens.

## Phase 4 — Test the delivery artifact independently of React
Whatever URL IPTVFlix ultimately gives to the browser must itself be proven valid.

### If DIRECT/proxy MP4
Test the final gateway URL with curl/ffprobe and verify:
- 200/206 behavior;
- correct Content-Type;
- byte ranges;
- Content-Length/Content-Range;
- no HTML/JSON error body masquerading as video;
- stream is not truncated;
- ffprobe recognizes it through the gateway.

### If HLS
Fetch the exact final `.m3u8` URL and verify:
- HTTP 200;
- `application/vnd.apple.mpegurl` or appropriate HLS MIME;
- playlist content is syntactically valid;
- every referenced child playlist/segment URL resolves from the browser's point of view;
- segment requests return media bytes, not JSON/HTML/404/401;
- relative URL resolution is correct;
- auth/session IDs remain valid across manifest and segment requests;
- ffmpeg can consume the IPTVFlix `.m3u8` for at least 30 seconds.

Save sanitized examples of manifest and request sequence in the run evidence.

## Phase 5 — Railway/runtime reality check
Playback must work in the environment where IPTVFlix is actually deployed.

Explicitly verify on the API Railway service:
- `ffmpeg -version` works;
- `ffprobe -version` works;
- the deployed SHA contains the expected playback code;
- filesystem paths used for HLS segments are writable and persist for the required session lifetime;
- generated segments are visible to subsequent HTTP requests;
- cleanup does not delete them prematurely;
- multiple Railway instances/replicas are not causing manifest creation on instance A and segment request on instance B;
- process lifecycle/redeploy is not killing sessions;
- memory/CPU limits are not killing ffmpeg;
- ffmpeg stderr and exit code are captured;
- upstream Xtream host is reachable from Railway.

If local playback works but Railway does not, treat this explicitly as a deployment/runtime architecture issue rather than changing the frontend blindly.

## Phase 6 — Browser/network inspection
Use a real browser session and inspect the network sequence after `Regarder`.

Record:
- resolver response;
- final playback URL;
- manifest request if HLS;
- first media/segment requests;
- status codes;
- response MIME types;
- CORS headers;
- mixed-content issues;
- media element error code/message;
- hls.js fatal/non-fatal errors when applicable.

Determine whether the browser is failing because of:
- unreachable URL;
- auth/session expiry;
- malformed HLS;
- codec incompatibility;
- CORS;
- mixed HTTP/HTTPS;
- Range implementation;
- wrong MIME;
- invalid media bytes;
- ffmpeg failure;
- frontend lifecycle/player bug.

## Phase 7 — Make one deterministic golden path work
Do NOT try to support every codec/provider combination before proving the baseline.

For the selected golden-path movie, choose the simplest reliable delivery strategy based on its actual codecs.

If transcoding is required, prefer a conservative browser-compatible target such as:
- video: H.264/AVC;
- audio: AAC;
- delivery: standards-compliant HLS;

For diagnostic purposes it is acceptable to force this known-compatible path for the golden movie. Optimization/remux/direct-play can be reintroduced only after correctness is proven.

Correctness first, optimization second.

## Phase 8 — Cross-device proof
Once the golden path works in desktop browser, validate the same movie on:
- desktop Chrome/Chromium;
- Android Chrome;
- iPhone Safari.

If one device still fails, capture the exact network/media error rather than replacing it with a generic "unsupported browser" message.

## Required diagnostic endpoint/tooling
Add a developer/admin-safe playback diagnostic mechanism if needed, capable of returning sanitized information for an availability:
- upstream reachable yes/no;
- HTTP status;
- detected container/codecs;
- selected delivery mode;
- ffmpeg/ffprobe availability;
- session state;
- manifest ready yes/no;
- segment count;
- last ffmpeg exit/error summary.

It MUST NOT expose Xtream credentials or raw secret-bearing URLs to normal clients.

## Error UX
Until playback works, replace generic catch-all errors with actionable categories such as:
- source stream unreachable;
- source authentication rejected;
- stream URL invalid;
- media probe failed;
- transcoder unavailable;
- transcoding failed;
- HLS manifest generation failed;
- HLS segment unavailable;
- browser rejected codec;
- playback session expired.

Keep user-facing wording simple while logging the technical reason server-side with the correlation ID.

## Tests
Tests should reproduce the actual failure modes discovered, not merely mocks that assert functions were called.

At minimum add integration coverage that:
1. exposes a realistic Xtream VOD fixture;
2. resolves the availability;
3. generates the actual delivery artifact;
4. fetches the manifest/media through HTTP;
5. verifies the returned content is real playable media/valid HLS;
6. catches regressions in URL paths, MIME types, session routing, and segment serving.

## Required evidence in implementation output
Before marking complete, include:
- selected golden-path movie/availability IDs (no secrets);
- actual root cause(s) found;
- upstream ffprobe summary;
- chosen delivery mode;
- sanitized resolver response;
- sanitized manifest/gateway URL shape;
- manifest validation result;
- ffmpeg-through-IPTVFlix 30-second validation result;
- browser network result;
- desktop result;
- Android result;
- iPhone result;
- Railway ffmpeg/ffprobe/runtime verification.

## Acceptance criteria
- [ ] A real Xtream VOD upstream stream is proven reachable and decodable independently of IPTVFlix.
- [ ] Xtream VOD URL construction is proven correct for the selected source.
- [ ] One correlation trace follows `Regarder` through every playback layer.
- [ ] The final IPTVFlix media/HLS URL is independently validated outside React.
- [ ] HLS manifests and every referenced segment resolve successfully when HLS is used.
- [ ] Railway runtime has working ffmpeg + ffprobe when required.
- [ ] Railway can reach the Xtream source.
- [ ] The golden-path movie displays moving video and produces audio in the WebApp.
- [ ] Desktop Chrome/Chromium is manually validated.
- [ ] Android Chrome is manually validated or an exact device-specific blocker is documented with evidence.
- [ ] iPhone Safari is manually validated or an exact device-specific blocker is documented with evidence.
- [ ] No Xtream credentials are exposed in browser-visible URLs/logs.
- [ ] Generic "cannot play" errors are backed by a concrete server-side diagnostic reason/correlation ID.
- [ ] Regression/integration tests cover the actual root cause found.

## STRICT completion rule
**DO NOT close/mark this ticket complete because TypeScript, unit tests, mocks, CI, ffmpeg command construction, or HLS generation code looks correct.**

The definition of done is observable playback of at least ONE REAL Xtream movie through the deployed/prod-like IPTVFlix path.

If the worker cannot access a real configured Xtream source or cannot perform the real-device validation, the result MUST be `BLOCKED / AWAITING REAL PLAYBACK VALIDATION`, with the diagnostic evidence gathered so far. It must NOT claim playback is fixed.