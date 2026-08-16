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