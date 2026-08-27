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


# T138 — Add Android TV universal channel/program search with voice and smart live launch

**Source**: GitHub Issue #293

## Description

## Context

Android TV Live should let the user search for **what they want to watch**, not force them to know which channel carries it.

Examples:
- `TF1` → show/open TF1.
- `US Open` → show channels broadcasting it right now plus upcoming broadcasts.
- `Fort Boyard` → if currently live, show the channel(s); if later, show channel + date/time.
- Voice query: `Je veux regarder l'US Open` should behave like a search for `US Open`.

This ticket consumes the universal canonical-channel + EPG search backend from the dedicated search API ticket.

## Goal

Create a remote-first **universal Live TV search screen for Android TV**, supporting text and Android TV voice input, with results grouped by current/future availability and smart playback behavior.

Use the Live TV **dark + orange** visual identity.

## Entry point

Expose Search as a first-class TV-mode destination/action accessible entirely with the remote.

Support:
- on-screen keyboard/text input through normal Android TV mechanisms;
- hardware/remote text input where Android provides it;
- Android TV voice search / microphone input where supported and permitted by the platform/device.

Voice is converted to the same search query used by text search; do not build a separate search algorithm.

## Result UX

Prefer a simple large-screen hierarchy:

### En direct maintenant
For matching programs airing now, show cards/rows with:
- canonical channel logo + name;
- program title;
- start/end and/or progress;
- clear `EN DIRECT` state;
- orange focus state.

### À venir
For matching future programs, show:
- canonical channel logo + name;
- program title;
- **date + local time prominently**;
- optionally relative wording (`ce soir`, `demain`) only in addition to an unambiguous date/time where useful.

Sort useful upcoming results chronologically after relevance.

### Chaînes
For direct channel-name matches, show canonical channel cards separately where appropriate.

Do not show raw provider/source duplicates.

## Smart launch behavior

### One unambiguous result currently live
When the search has **exactly one high-confidence playable LIVE_NOW result** and no meaningful ambiguity:
- allow fast direct playback;
- product may auto-launch it after a very short visible/cancellable affordance, or require one OK press if that is safer with the existing Android TV interaction model;
- in either implementation, getting from `US Open` to the only channel currently showing it should require minimal friction.

Do not auto-launch weak/fuzzy matches.

### Multiple live results
Show all matching channels and let the user choose with the D-pad + OK.

### Future-only results
Never start a channel merely because the requested program will air later.
Show the upcoming result list with **channel + date + time**.

### Live + future
Prioritize `En direct maintenant`; keep future occurrences visible below.

## Playback integration

Selecting a live result:
- starts the canonical channel through the same source-selection/failover path used by Live TV playback;
- enters the normal Live player;
- all existing zapping and channel-overlay behaviors remain available afterward.

Selecting a direct channel result starts that channel normally.

Selecting an upcoming program does not fake playback. For this ticket it may simply focus/show its schedule details; future reminder functionality can build on the program identifier later.

## Search interaction

- Debounce incremental text queries appropriately.
- Preserve query/result state when backing out of a result/player where sensible.
- Focus must be deterministic when result groups appear/update.
- Empty state should distinguish `aucun programme trouvé` from network/API failure.
- Search should remain usable when EPG is missing: channel-name search still works.

## Voice UX

Where Android TV microphone/voice APIs are available:
- microphone action is clearly focusable;
- spoken text is visible as the resulting query;
- user can edit/retry it;
- gracefully fall back to text search on devices without voice capability.

No always-listening microphone behavior.

## Future-ready reminder affordance

Keep the upcoming-result component/API integration ready for a future action such as:
- `Me prévenir au début`;
- `Ajouter à mes événements TV`.

Do not implement reminder scheduling in this ticket unless an existing generic reminder mechanism already makes it trivial.

## Acceptance criteria

- [ ] Android TV Live exposes universal Search accessible with D-pad.
- [ ] Search can find canonical channels by name.
- [ ] Search can find EPG programs such as `US Open` / `Fort Boyard` and separate current from upcoming broadcasts.
- [ ] `En direct maintenant` results display channel + program information and can launch playback.
- [ ] `À venir` results prominently display canonical channel + date + time and do not launch as though already live.
- [ ] Multiple current broadcasters are presented as a selectable list.
- [ ] A single high-confidence currently-live result has a minimal-friction launch path without auto-launching fuzzy/ambiguous results.
- [ ] Voice input uses Android TV-supported microphone/search mechanisms where available and falls back cleanly to text.
- [ ] Orange Live TV focus/active styling is used throughout.
- [ ] Raw duplicate `ChannelSource` entries never appear as separate results.
- [ ] Playback uses canonical source selection/failover and integrates with existing Live player/zapping/side-overlay features.
- [ ] Search remains useful for channels when EPG is unavailable.
- [ ] Add Android tests for channel search, live program search, upcoming-only search, multiple live matches, unique-live fast launch, voice/text query flow, focus restoration and no-EPG behavior.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
