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


# T079 — Fix Safari/iOS video decode failures with automatic playback compatibility fallback

**Source**: GitHub Issue #167

## Description

## Context
#162 and #163 are finished, and playback now reaches the player, but Safari on iPhone shows a hard failure: `Erreur de décodage vidéo`.

This means the end-to-end path is now wired far enough to fetch media, but the delivered container/codec is not reliably decodable by Safari/iOS. #163 explicitly required browser-incompatible container handling, so this is a post-completion regression/follow-up that must close the remaining compatibility gap.

## Goal
Make Movie and Episode playback actually work on Safari/iOS by detecting incompatible media and automatically falling back to a browser-compatible delivery path without requiring user intervention.

## Requirements

### 1. Reproduce and classify the decode failure
Capture enough diagnostics to distinguish:
- unsupported container;
- unsupported video codec/profile/level;
- unsupported audio codec;
- malformed upstream stream;
- wrong Content-Type;
- broken/incomplete Range behavior;
- corrupt/invalid provider response.

Do not expose Xtream credentials in logs or UI.

### 2. Inspect real stream metadata server-side
For the selected availability, inspect upstream media characteristics as needed before/while delivering it. Determine actual container + video/audio codecs rather than trusting only file extension.

Use a lightweight probing mechanism appropriate to the backend deployment (e.g. ffprobe/ffmpeg tooling if already acceptable for Railway deployment), with caching so the same variant is not reprobed on every play.

### 3. Compatibility decision
Introduce a clear playback capability decision for target browsers, especially Safari/iOS.

Examples:
- browser-native MP4/H.264/AAC → direct/proxy pass-through;
- HLS with compatible codecs → serve as HLS;
- MKV/TS with browser-compatible elementary codecs → remux without transcoding when possible;
- unsupported video/audio codec → transcode only when truly required.

Do not default to expensive transcoding if simple remux is enough.

### 4. Automatic fallback
When direct playback would fail on Safari/iOS, automatically use a compatible delivery path. The user should still press `Regarder` once; they should not have to understand containers/codecs or manually pick a technical mode.

Preferred order:
1. direct/native when proven compatible;
2. pass-through via IPTVFlix gateway when only CORS/HTTP/range is the issue;
3. remux to a compatible container/streaming format;
4. transcode only when codecs themselves are incompatible.

### 5. HLS/remux delivery
Where appropriate, use an HLS or fMP4-compatible output that Safari handles reliably. If generated dynamically:
- stream progressively rather than waiting for full-file conversion;
- clean temporary segments/resources;
- handle client disconnects;
- avoid unbounded disk growth;
- support seeking/resume where technically feasible;
- avoid launching duplicate heavy jobs for the same user/session unnecessarily.

### 6. Railway deployment readiness
If ffmpeg/ffprobe is required, package/install it explicitly in the API deployment so production behavior matches local tests. Do not rely on an undeclared binary existing magically on Railway.

Keep CPU/memory implications observable and bounded.

### 7. Playback API contract
The existing playback resolver/session should be extended so the frontend receives a browser-compatible IPTVFlix playback URL/mode, not a raw provider URL that Safari cannot decode.

The frontend should not need provider-specific codec logic.

### 8. UX and retry
Replace the generic `Erreur de décodage vidéo` dead-end with a fallback-aware flow:
- automatically attempt the compatibility fallback when possible;
- only show an error after all supported delivery strategies fail;
- keep `Réessayer` useful;
- provide a concise user-facing failure message while backend logs retain technical detail.

### 9. Variant fallback
If several canonical variants exist and the preferred one is incompatible/unusable, optionally try another compatible variant before expensive transcoding when product preferences allow it (e.g. 4K HEVC fails but 1080p H.264 is available). Do not silently switch languages unexpectedly.

### 10. Test matrix
Add automated/integration coverage for representative cases:
- MP4 H.264/AAC native;
- MKV containing H.264/AAC → remux and play;
- MPEG-TS compatible codecs → Safari-compatible delivery;
- HEVC/H.265 case according to actual iOS support/profile/container constraints;
- unsupported audio codec requiring remux/transcode;
- Range/seek/resume;
- upstream failure;
- fallback from preferred incompatible variant to compatible alternative;
- no credential leakage.

## Acceptance criteria
- [ ] The currently failing real iPhone/Safari playback case plays successfully after deployment.
- [ ] Safari/iOS does not receive a raw media format known to be undecodable when IPTVFlix can remux/convert it.
- [ ] Media is probed/classified by actual container/codecs when needed.
- [ ] Compatible media stays on the cheap direct/pass-through path.
- [ ] Remux is preferred over transcoding when possible.
- [ ] Transcoding is used only when codec incompatibility requires it.
- [ ] Any ffmpeg/ffprobe dependency is explicitly deployable on Railway.
- [ ] Fallback happens automatically from a single `Regarder` action.
- [ ] Frontend receives a browser-compatible IPTVFlix playback target/mode.
- [ ] Retry/error UX is no longer a silent/generic decode dead-end.
- [ ] Resume/seek remain functional where supported.
- [ ] Credentials/full Xtream URLs are never logged or exposed unnecessarily.
- [ ] Automated tests cover the compatibility matrix and fallback paths.

## Regression evidence
Observed on iPhone Safari in production after #162/#163 completion: player opens, then displays `Erreur de décodage vidéo` with a retry button. This issue is not complete until that production-like iOS case is proven working.