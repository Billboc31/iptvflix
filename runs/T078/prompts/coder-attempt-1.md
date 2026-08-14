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


# T078 — Make web playback actually play resolved Xtream streams end-to-end

**Source**: GitHub Issue #163

## Description

## Problem
Even when a Movie/Episode resolves to a playback session, clicking `Regarder` currently results in no media actually playing in the web app.

Fixing provider URL construction (#162) is necessary but not sufficient: the browser playback path itself must be proven end-to-end against real Xtream VOD constraints.

## Goal
Deliver a reliable web playback flow from UI action → availability resolution → playable media in the browser, with clear fallback/error behavior when a provider format cannot be played directly.

## End-to-end flow to implement/verify

```text
Movie/Episode detail
   ↓ Regarder
availability selection
   ↓
POST /playback/resolve/:mediaType/:mediaId
   ↓
playback session
   ↓
web player
   ↓
actual bytes/manifest fetched
   ↓
video starts
```

The ticket is complete only when a real imported Movie and a real imported Episode can be played from the web UI.

## Requirements

### 1. Inspect and wire the current UI playback action
Trace every `Lecture` / `Regarder` entry point (detail modal, hero, episode card, etc.) and ensure it reaches one shared playback flow.

Do not leave buttons that only resolve metadata or update state without mounting/starting a player.

### 2. Real web player
Provide a production-grade player surface for Movie and Episode playback.

At minimum:
- visible loading/buffering state;
- play/pause;
- seek for VOD when supported;
- volume/mute;
- fullscreen;
- current/duration display;
- clean close/back behavior;
- resume from `startPositionSeconds`;
- playback error display that is useful rather than silent.

Reuse existing player work if present rather than creating duplicate players.

### 3. Browser format compatibility
Do not assume every Xtream VOD stream is browser-native.

Handle the formats actually produced by imported availabilities (e.g. mp4, TS, HLS where applicable, mkv/other containers). The Planner must determine which can be played directly and which need a backend gateway/remux/transcode strategy.

A `.mkv` URL or MPEG-TS stream must not simply be assigned to `<video src>` and considered done if target browsers cannot reliably decode it.

### 4. Playback gateway / proxy when needed
If direct provider URLs are unsuitable because of CORS, mixed-content, credentials, Range requests, headers, container support or browser restrictions, introduce a backend playback endpoint/gateway rather than exposing fragile provider access directly to the browser.

The gateway should, as required by the chosen implementation:
- keep Xtream credentials server-side;
- support HTTP Range / seeking for VOD;
- forward appropriate content type/length/range headers;
- stream rather than buffer entire media in memory;
- handle upstream disconnect/timeouts;
- avoid logging secrets;
- allow future reuse by Send to TV/other clients where sensible.

Do not implement expensive transcoding unless it is actually required; prefer pass-through/remux where feasible.

### 5. HTTPS / mixed-content and CORS
Production web is HTTPS. Playback must work even when an Xtream provider exposes HTTP URLs.

The browser must not be expected to fetch insecure credential-bearing provider URLs directly from an HTTPS IPTVFlix page.

Resolve CORS/mixed-content issues through the backend architecture rather than documenting a browser workaround.

### 6. Credentials
Do not return permanent raw Xtream username/password URLs to the browser if a backend gateway can avoid it.

Playback responses should expose an IPTVFlix playback URL/session/token where appropriate, with provider credentials remaining server-side.

### 7. Variant switching
If the current media has FR/VO/4K/1080p/etc. alternatives, switching availability should restart/re-resolve playback through the same player without creating a separate media identity.

Show the selected variant clearly.

### 8. Progress persistence
Wire playback progress to the existing viewing-progress model:
- resume at returned start position;
- periodically persist progress without excessive requests;
- persist on pause/close/unmount where possible;
- mark completion according to existing product rules;
- keep Movie/Episode semantics correct.

### 9. Error diagnosis
Surface distinct useful categories for:
- no playable availability;
- provider unauthorized/expired credentials;
- provider 404/invalid item id;
- upstream timeout;
- unsupported media/container/codec;
- browser decode failure;
- CORS/mixed-content should be eliminated by architecture, not shown as mysterious generic failure.

Backend logs should correlate media id + availability id + source id + playback session without logging credentials/full secret URL.

### 10. Production verification
Add an explicit smoke-test/debug procedure that can verify a selected real availability in production-like conditions. Automated tests may mock provider media, but acceptance also requires proving the actual web integration path rather than only unit-testing URL strings.

## Acceptance criteria
- [ ] Clicking `Regarder` on an available Movie opens/starts the shared web player.
- [ ] Clicking an available Episode starts the same playback system.
- [ ] A real Xtream Movie plays end-to-end in the supported production browser target.
- [ ] A real Xtream Episode plays end-to-end.
- [ ] HTTPS web deployment does not depend on direct HTTP mixed-content provider requests.
- [ ] Xtream credentials are not exposed unnecessarily in browser-visible URLs/logs.
- [ ] Browser-incompatible container handling is deliberate and tested.
- [ ] Range/seek works for VOD where technically supported.
- [ ] Resume from existing viewing progress works.
- [ ] Progress is persisted during/after playback.
- [ ] Switching variants works through the same canonical media/player flow.
- [ ] Playback failures are visible and diagnosable rather than silently doing nothing.
- [ ] Hero/detail/episode Play actions all converge on the same playback implementation.
- [ ] Automated integration tests cover resolver → playback endpoint/player contract.

## Dependency
#162 should fix the correctness of Xtream Movie/Episode playback targets. This issue owns the browser/player/gateway end-to-end path and should integrate that corrected resolver rather than duplicating provider URL rules.