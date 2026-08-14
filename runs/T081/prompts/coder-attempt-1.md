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


# T081 — Fix production Safari/iOS playback based on diagnostic findings

**Source**: GitHub Issue #171

## Description

## Dependency
This ticket MUST be implemented after #170 `Diagnose production Safari/iOS playback failure after compatibility fallback` has produced an evidence-backed root cause.

Do not guess a new playback architecture before reading #170's diagnostic report and real production evidence.

## Goal
Apply the concrete fix identified by #170 so real imported Xtream Movies and Episodes play successfully on Safari/iOS in the production-like Railway deployment.

The existing layered playback architecture should be preserved where sound:
- canonical Movie/Episode identity;
- availability/variant resolver;
- IPTVFlix playback session/gateway;
- cheap direct/pass-through path for compatible media;
- compatibility fallback for incompatible media.

Change only the layers required by the diagnosed root cause, while making the solution robust enough for equivalent streams.

## Required implementation process

### 1. Consume #170 diagnosis
The implementation plan must quote/summarize the confirmed root cause from #170 and identify the exact affected code path(s).

Possible areas include, but are not limited to:
- wrong compatibility classification;
- invalid ffmpeg arguments;
- incompatible fragmented MP4 output;
- missing/misleading MIME headers;
- output buffering/fragmentation incompatible with Safari;
- Range/seek behavior;
- upstream redirects/authentication;
- ffmpeg/ffprobe missing in actual Railway runtime;
- premature process termination;
- frontend source-switch/retry bug;
- unsupported codecs requiring a different transcode path.

Only implement what evidence supports.

### 2. Fix the real delivery path
Correct the gateway/player behavior so the real failing stream diagnosed in #170 becomes playable from a single `Regarder` action on iPhone Safari.

If remux/transcode is required, output must be in a delivery format Safari can consume progressively and reliably. Prefer the least expensive correct path.

### 3. Preserve fast path
Do not route every stream through heavy transcoding merely to fix one compatibility case.

Native-compatible streams should continue using direct/proxy delivery when proven safe.

### 4. Production deployment correctness
Any required runtime dependency/configuration must be explicit and actually active on Railway. If the fix needs ffmpeg flags, binaries, temp storage, environment/config, or a different build/deployment definition, include and test it.

### 5. HTTP/media correctness
Ensure the corrected playback endpoint returns headers/body semantics matching the media produced:
- correct Content-Type;
- appropriate status codes;
- valid streaming/chunking behavior;
- Range/Content-Range where applicable;
- no contradictory Content-Length;
- no premature termination;
- no raw provider credentials.

### 6. Frontend behavior
The web player should automatically consume the corrected delivery path. The user must not choose a `compatibility mode` manually.

`Réessayer` should create/retry a valid playback attempt rather than repeating a known-broken URL/session.

### 7. Regression coverage
Add a regression fixture/test that represents the concrete failing media characteristics found in #170. Tests should fail against the pre-fix implementation and pass after correction.

Retain coverage for existing compatible MP4/HLS/direct paths and ensure they are not regressed.

### 8. Real-device verification is BLOCKING
Unlike T079, this ticket must NOT be considered fully complete solely because automated tests pass.

The implementation/review/test artifacts must explicitly require validation of the deployed fix against the real iPhone/Safari case identified in #170.

If the autonomous worker cannot physically validate the user's device, mark that acceptance criterion as pending/manual rather than claiming full success. Do not state the bug is fixed until production evidence confirms playback starts.

## Acceptance criteria
- [ ] #170 root cause is explicitly referenced in the implementation plan.
- [ ] The diagnosed root cause is corrected rather than bypassed with an unrelated speculative rewrite.
- [ ] The real failing media characteristics have a regression test/fixture.
- [ ] Compatible streams still use the cheap path where appropriate.
- [ ] Safari receives valid compatible media and correct HTTP headers/stream semantics.
- [ ] Any ffmpeg/ffprobe/runtime requirement is genuinely present in Railway production runtime.
- [ ] One `Regarder` action automatically chooses the working path.
- [ ] Retry does not simply repeat a known broken playback target.
- [ ] Movie playback remains functional.
- [ ] Episode playback remains functional.
- [ ] No Xtream credentials/full secret URLs leak to browser logs/server logs.
- [ ] Automated tests pass for the diagnosed regression and existing playback paths.
- [ ] Production iPhone/Safari playback of the real case is treated as a BLOCKING manual acceptance check, not silently marked PASS when unverifiable.

## Completion rule
Code/tests may reach `TEST_COMPLETE`, but product-level closure should only happen after the real production Safari/iOS playback case is confirmed working. If manual confirmation is unavailable, report `awaiting real-device verification` rather than `fixed`.