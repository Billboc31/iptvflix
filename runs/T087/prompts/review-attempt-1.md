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


# T087 — Validate a real Xtream VOD stream and choose the viable playback delivery architecture

**Source**: GitHub Issue #184

## Description

## Context
Playback is still not working after several implementation attempts.

T085/#180 finally improved observability and correctly ended as `BLOCKED / AWAITING REAL PLAYBACK VALIDATION` instead of claiming success. Its evidence also surfaced a potentially critical infrastructure constraint: the Xtream provider may reject requests originating from Railway/datacenter IPs (observed/expected HTTP 403 through Cloudflare), while IPTVFlix currently falls back to redirecting the browser directly to the credential-bearing Xtream URL.

At the same time, real playback is still failing on both iPhone/Safari and Android/Chrome.

We must now stop changing codecs/player logic speculatively. Before writing another playback architecture, prove exactly what a REAL provider stream does from each network/client path and choose the architecture from evidence.

## Primary goal
Using ONE real movie availability already stored in IPTVFlix production/prod-like data:

1. prove the original Xtream VOD URL is correct;
2. prove whether the media itself is valid/playable;
3. test the stream independently of IPTVFlix;
4. determine exactly which network paths can reach it;
5. determine whether browsers can consume it directly;
6. determine whether Railway can consume/proxy/transcode it;
7. based on those facts, explicitly choose and document the viable production architecture:
   - direct client playback,
   - IPTVFlix/Railway relay,
   - dedicated media relay outside Railway,
   - or a hybrid strategy.

This is an architecture decision + proof ticket. Do NOT implement another large speculative playback rewrite before the evidence exists.

## Phase 1 — Select one real golden stream
Pick a real movie with a real Xtream availability from the configured database.

Record SANITIZED identifiers:
- movie ID/title;
- availability ID;
- source ID;
- Xtream stream ID;
- `container_extension`;
- stored quality/language metadata;
- generated URL shape with username/password redacted.

Confirm URL construction against the actual provider API response, not assumptions.

For VOD, explicitly verify whether the provider expects:

`{base}/movie/{username}/{password}/{streamId}.{extension}`

or another form.

## Phase 2 — Prove the stream outside IPTVFlix
From a normal residential/client network, test the exact real upstream stream independently of IPTVFlix.

At minimum use appropriate tools such as:
- `curl`;
- `ffprobe`;
- `ffmpeg`;
- VLC or another known-good media player.

Capture sanitized evidence for:
- HTTP status;
- redirect chain;
- response Content-Type;
- whether bytes arrive;
- container;
- video codec/profile/resolution;
- audio codec;
- duration;
- whether ffmpeg can decode/read at least 30 seconds;
- whether VLC can visibly play video + audio.

### Decision gate A
If VLC/ffmpeg cannot play the original upstream URL, STOP browser debugging. The problem is provider URL/auth/source resolution and must be fixed there first.

## Phase 3 — Test the SAME URL from Railway
From the deployed Railway API runtime, test the exact same sanitized golden stream with `curl`, `ffprobe`, and where possible a short ffmpeg read.

Capture:
- HTTP status;
- Cloudflare/server response headers;
- redirect behavior;
- whether the body is media or an HTML/JSON denial page;
- whether `ffprobe` succeeds;
- whether ffmpeg can read 30 seconds;
- Railway egress IP/network characteristics if observable without exposing sensitive infrastructure data.

### Explicitly prove or disprove the current hypothesis
**Does the provider reject Railway/datacenter-origin requests while allowing residential/client-origin requests?**

Do not write `expected 403` as evidence. Produce the actual result from the deployed environment.

### Decision gate B
If Railway receives 403 while residential/client access receives valid media, mark `RAILWAY_PROVIDER_BLOCK_CONFIRMED` and do not design a Railway-based proxy/transcoder as the only production path.

## Phase 4 — Direct browser test without IPTVFlix playback abstractions
Test the original provider stream as directly as technically possible from:
- desktop Chrome/Chromium;
- Android Chrome;
- iPhone Safari.

Capture the actual browser/network/media errors.

Determine separately whether failure is caused by:
- CORS;
- HTTP/HTTPS mixed content;
- unsupported container;
- unsupported video codec;
- unsupported audio codec;
- redirects;
- provider anti-hotlink/user-agent restrictions;
- Range handling;
- cookies/headers required by provider;
- malformed media;
- browser inability to play the provider format.

Do not collapse all of these into `browser unsupported`.

## Phase 5 — Test provider HLS capabilities
Investigate the actual Xtream provider capabilities for this stream/source.

Determine whether the provider can natively return:
- `.m3u8` HLS for VOD;
- MPEG-TS;
- MP4;
- MKV;
- another container.

Do NOT simply replace the DB extension with `.m3u8` and assume it is supported. Test the provider response.

If provider-native HLS exists, validate its manifest and at least several segments from the client network and Railway separately.

## Phase 6 — Evaluate the four architecture candidates
Based strictly on measured results, produce an ADR/evidence document comparing:

### A — Direct client → Xtream
```text
Browser / app
      ↓
Xtream provider
```
Evaluate:
- reachability;
- browser codec/container support;
- CORS;
- mixed content;
- credential exposure;
- seek/range;
- iPhone/Android compatibility;
- feasibility for native Android TV later.

### B — Client → Railway IPTVFlix API → Xtream
```text
Browser
   ↓
Railway API
   ↓
Xtream
```
Evaluate:
- provider datacenter blocking;
- bandwidth cost;
- ffmpeg CPU/memory;
- HLS sessions;
- Railway filesystem/session behavior;
- scalability.

If provider blocks Railway, explicitly mark this architecture non-viable for that source unless the block can legitimately be resolved.

### C — Client → dedicated media relay → Xtream
```text
Browser
   ↓
Media Relay
   ↓
Xtream
```
Evaluate whether a separately deployed relay with appropriate network characteristics could:
- access provider;
- hide credentials;
- proxy Range requests;
- remux/transcode to browser-safe HLS;
- provide stable URLs;
- support multiple users later.

Do NOT deploy new infrastructure in this ticket unless a tiny disposable proof is necessary and explicitly documented.

### D — Hybrid
For example:
- direct provider-native HLS when browser compatible;
- direct/native playback on Android TV;
- media relay only when remux/transcode is required.

Evaluate complexity versus reliability.

## Phase 7 — Credential/security analysis
T085 documented that the current 302 fallback can expose:

`/movie/{username}/{password}/{streamId}...`

in browser-visible `Location`/network/history.

Treat this as a real architecture constraint.

Document whether the chosen strategy can avoid exposing provider credentials. Investigate provider-supported token/session mechanisms if actually available, but do not invent them.

Never commit or log real credentials in evidence files.

## Phase 8 — Produce a concrete architecture decision
Create an ADR or equivalent evidence artifact containing:
- facts observed;
- residential upstream result;
- Railway upstream result;
- VLC result;
- ffprobe/ffmpeg result;
- desktop browser result;
- Android result;
- iPhone result;
- provider-native HLS result;
- Railway blocking confirmed yes/no;
- codec/container compatibility;
- credential implications;
- selected architecture;
- rejected alternatives and why;
- exact next implementation ticket(s) required.

The decision must be specific enough that the next coder does not need to guess whether to implement direct playback, proxying, HLS transcoding, or a relay.

## Optional diagnostic helper
Reuse the existing playback diagnostic endpoint/correlation IDs from T085 where useful. Extend diagnostic tooling only if needed to expose sanitized evidence.

Do not build another large player subsystem in this ticket.

## Acceptance criteria
- [ ] One REAL Xtream movie availability is selected and traced.
- [ ] Its provider URL semantics are proven against the actual source/provider response.
- [ ] Original stream is tested from a normal client/residential network.
- [ ] Original stream is tested with ffprobe/ffmpeg where available.
- [ ] Original stream is visibly tested in VLC or equivalent known-good player.
- [ ] The SAME stream is tested from the deployed Railway runtime.
- [ ] Railway provider blocking is conclusively confirmed or disproven with actual HTTP evidence.
- [ ] Desktop browser direct-stream behavior is captured.
- [ ] Android Chrome direct-stream behavior is captured.
- [ ] iPhone Safari direct-stream behavior is captured.
- [ ] Provider-native HLS capability is tested rather than assumed.
- [ ] Actual container/video/audio codecs are documented.
- [ ] CORS/mixed-content/codec/provider restrictions are distinguished.
- [ ] Current credential exposure through redirect is assessed.
- [ ] Direct-client, Railway relay, dedicated relay, and hybrid architectures are compared.
- [ ] Exactly one recommended production direction is selected, with evidence.
- [ ] Follow-up implementation scope is explicitly described.
- [ ] No real Xtream credential is committed or printed in persistent logs/artifacts.

## STRICT completion rule
This ticket MUST NOT conclude with another speculative `probably Cloudflare`, `probably codec`, or `probably Safari` diagnosis.

It is complete only when we have measured evidence showing:

```text
REAL XTREAM STREAM
       ↓
Residential/client:  PASS or exact failure
Railway:             PASS or exact failure
VLC/ffmpeg:          PASS or exact failure
Desktop browser:     PASS or exact failure
Android browser:     PASS or exact failure
iPhone Safari:       PASS or exact failure
       ↓
ONE ARCHITECTURE DECISION
```

If the worker cannot access the real source or required environment, mark the ticket `BLOCKED` and state exactly what manual command/test the owner must perform. Do not mark it fixed.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
