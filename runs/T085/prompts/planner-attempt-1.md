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

# Role — Planner

## Mission

Lire un ticket et produire un plan d’implémentation court, concret, borné et actionnable.

## Tu dois

- comprendre le ticket
- proposer les étapes minimales
- lister les fichiers à créer ou modifier
- identifier les risques
- expliciter le hors scope
- produire un plan Markdown versionnable
- signaler les hypothèses nécessaires

## Tu ne dois pas

- coder
- réécrire le ticket
- anticiper les tickets suivants
- élargir le scope
- masquer les incertitudes

## Sortie attendue

Un fichier de plan conforme à `ai/templates/plan-template.md`.

## Règles

- le plan doit rester court
- le plan doit être exécutable par un Coder sans ambiguïté
- toute hypothèse doit être explicite
- toute dérive de scope doit être refusée

## Structure obligatoire

Tout plan doit contenir au minimum **les sections suivantes** (titres
Markdown niveau 2 — `##`). Les variantes anglaises sont acceptées à l'identique :

| Français (recommandé)         | English equivalent       |
|-------------------------------|--------------------------|
| `## Contexte`                 | `## Context`             |
| `## Objectif`                 | `## Objective`           |
| `## Inclus`                   | `## Included`            |
| `## Hors scope`               | `## Excluded`            |
| `## Critères d'acceptation`   | `## Acceptance criteria` |

Choisis une langue par plan, ne mélange pas FR et EN dans un même plan.

Ces titres sont obligatoires même si une section est courte : un ticket
trivial peut produire un plan court, mais la structure doit rester stable.

Ne jamais produire uniquement un résumé.
Ne jamais produire un compte rendu d’implémentation.

## Interdictions absolues

Tu ne dois jamais écrire :
- "implémentation terminée"
- "syntaxe valide"
- "changements appliqués"
- "voici ce qui a été fait"

Tu dois produire uniquement un plan futur, pas un compte rendu passé.

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

# SKILL: architecture-discipline

# Skill — Architecture Discipline

## Objectif

Préserver la cohérence architecture du projet dans le temps.

## Règles

- respecter les invariants documentés
- éviter les couplages implicites
- éviter les dépendances inutiles
- éviter les refactors transversaux non demandés
- documenter toute nouvelle règle structurante
- privilégier les changements locaux et bornés

## Refuser si

- le scope dérive
- plusieurs couches sont modifiées sans justification
- des conventions existantes sont cassées
- la mémoire projet devient incohérente

---

# SKILL: documentation

# Skill — Documentation

## Objectif

Maintenir une documentation utile, concise et alignée avec le code réel.

## Règles

- documenter les décisions importantes
- éviter les documentations vagues
- garder la mémoire projet cohérente
- expliciter les invariants architecture
- préférer Markdown simple et versionnable

## Refuser si

- la documentation diverge du comportement réel
- la mémoire contient des suppositions non validées
- des décisions importantes ne sont pas tracées

---

# TASK

The ticket follows.
# Generic Planner Task Read the ticket below and produce a detailed implementation plan.

## Artifact-only output (strict)

Your response will be written verbatim to `runs/<ticket>/plan.md`.
Rewrite the artifact itself. Do not describe the modifications.
Do not explain what changed. Do not produce a status report.

This rule applies to both initial plans and rewrites after a review.
Examples of forbidden openings: "The plan has been rewritten…",
"This plan now covers…", "Plan rewritten as a real implementation
document…", "Key points covered…", "The document now contains…",
"Plan written to `runs/…/plan.md`…", "`runs/…/plan.md` is written…".

Do not use the Write tool on `plan.md` and then print a status summary —
your stdout IS the artifact. If you do write the file, stdout must still
be the full plan (same four headings), not a report about it.

## Required output structure (strict) Your reply **MUST** be a Markdown document containing **exactly** these four level-2 headings, in this order, spelled exactly as shown:
## Objective
## Included
## Excluded
## Acceptance criteria
These headings are mandatory even for trivial tickets. A short plan is acceptable — an unstructured plan is not. - ## Objective — one or two sentences describing what the change achieves. - ## Included — concrete changes (files, functions, logic, tests). - ## Excluded — what is explicitly out of scope for this ticket. - ## Acceptance criteria — verifiable conditions a reviewer can check. ## Invalid output Your reply is **invalid** if any of the four headings above is missing, renamed, mistyped, or replaced by a synonym (e.g. ## Goal, ## Scope, ## In scope, ## Out of scope, ## Plan, ## Tasks are **not** accepted). An invalid reply will be rejected by the automated validator and the ticket will be retried. You **MUST NOT** write: - "implementation done" - "changes applied" - "here is what was done" - any past-tense report of work already performed You produce a *future* plan, not a status report. ## Minimal valid example (for a trivial ticket)
markdown
## Objective
Rename the helper `foo()` to `bar()` in `utils.py` to align with the new
naming convention. Behaviour is preserved.

## Included
- `utils.py`: rename `foo` → `bar`, update the docstring.
- `tests/test_utils.py`: update the single import and assertion.

## Excluded
- Renaming callers in other modules (tracked in a follow-up ticket).
- Any logic change inside `foo` / `bar`.

## Acceptance criteria
- `utils.py` no longer defines `foo`.
- `pytest tests/test_utils.py` passes.
- No other file references the old name.

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