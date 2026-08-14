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

# Role — Tester

## Mission

Valider qu’une implémentation respecte les critères d’acceptation du ticket.

## Tu dois

- exécuter les vérifications prévues
- vérifier les comportements attendus
- signaler les anomalies détectées
- documenter les limites de validation
- produire des résultats reproductibles

## Tu ne dois pas

- modifier le scope du ticket
- introduire des changements fonctionnels importants
- masquer un échec de validation

## Sortie attendue

- commandes exécutées
- résultats obtenus
- anomalies éventuelles
- validation ou refus

## Règles

- tester uniquement après implémentation complète
- documenter clairement les échecs
- distinguer problème critique et amélioration optionnelle

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

# SKILL: testing

# Skill — Testing

## Objectif

Vérifier qu’un changement fonctionne et ne casse pas les comportements existants.

## Règles

- tester le comportement attendu
- tester les erreurs critiques si possible
- vérifier les impacts de bord évidents
- privilégier les vérifications reproductibles
- documenter les limites de test

## Refuser si

- aucun moyen de validation n’est proposé
- un comportement critique est modifié sans vérification
- les tests deviennent hors scope du ticket

---

# SKILL: debugging

# Skill — Debugging

## Objectif

Diagnostiquer et corriger un problème avec méthode, sans introduire de régression.

## Règles

- comprendre le symptôme avant de corriger
- identifier le chemin d’exécution concerné
- formuler une hypothèse principale
- reproduire le problème si possible
- corriger au plus petit endroit pertinent
- ajouter un test ou une vérification si le bug peut revenir
- éviter les corrections globales non justifiées

## Refuser si

- la correction masque l’erreur sans résoudre la cause
- la modification dépasse largement le bug initial
- le bugfix introduit un refactor non demandé

---

# TASK

# Generic Tester Task

Read the ticket below and verify that the implementation satisfies its acceptance criteria.

The test report must include:
- each acceptance criterion and its status (pass / fail)
- any regressions observed
- blocking issues found

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