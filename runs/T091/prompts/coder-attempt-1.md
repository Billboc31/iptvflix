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


# T091 — Optimize VOD streaming to reduce buffering and match native IPTV app performance

**Source**: GitHub Issue #191

## Description

## Context
The same IPTV source plays smoothly in a normal/native IPTV app, but IPTVFlix playback currently lags/buffers more. Since the upstream source can evidently sustain playback, investigate and optimize IPTVFlix-specific transport/player overhead rather than blaming provider bandwidth by default.

## Goal
Make IPTVFlix VOD playback start faster, buffer less and recover better, while preserving the now-working video path and seekability.

## Required measurement first
Use the SAME real movie/source in IPTVFlix and in a known-good IPTV client where possible. Gather comparable evidence:
- startup time to first frame;
- average bitrate;
- rebuffer count/duration;
- download throughput;
- buffer ahead seconds;
- request pattern;
- segment/Range sizes;
- CPU/memory usage;
- delivery mode;
- browser/device/network.

Identify where IPTVFlix loses performance.

## Investigate likely causes
- too-small HLS segment/buffer settings;
- unnecessary remux/transcode when direct/remux is sufficient;
- ffmpeg startup per request/session;
- gateway copying/buffering entire chunks instead of streaming them;
- Node stream backpressure/highWaterMark issues;
- Range requests not forwarded optimally;
- missing keep-alive/connection reuse to provider;
- redirect/proxy overhead;
- HLS manifest/segment latency;
- browser player buffer configuration;
- aggressive cleanup/session expiration;
- frontend source reloads caused by React state rerenders;
- duplicate media requests;
- seeking/progress-save logic causing reloads;
- Railway CPU/memory/network bottlenecks if the playback path traverses Railway;
- provider path differences between IPTVFlix and native client.

## Delivery strategy
Do not transcode by default if codecs are already browser-compatible. Prefer, in order where viable:
1. direct/native provider HLS;
2. direct/proxy byte stream with correct Range support;
3. remux without re-encoding;
4. transcode only when codec compatibility requires it.

If current playback is direct from client to Xtream, optimize player/network behavior without reintroducing a server relay that the provider blocks.

## Buffering UX
- maintain a useful forward buffer;
- do not stall because UI progress/save calls fire;
- show buffering state only when genuinely stalled;
- recover/retry transient segment/network failures gracefully;
- avoid restarting playback from zero after transient errors.

## Acceptance criteria
- [ ] Root cause(s) of excess buffering identified with measurements.
- [ ] Startup time and rebuffer behavior measured before/after.
- [ ] No unnecessary transcoding for already-compatible streams.
- [ ] Network requests are streamed efficiently with proper backpressure/Range semantics where applicable.
- [ ] No duplicate/repeated source reloads during normal playback.
- [ ] Real movie plays materially more smoothly on the same network/device.
- [ ] Seek/pause/resume remain functional.
- [ ] Existing playback transport that currently works is not regressed.
- [ ] Performance findings documented using a real Xtream stream.

## Completion rule
Do not close based on synthetic unit tests. Run a real long movie for enough time to observe buffering and compare before/after under the same connection/device conditions.