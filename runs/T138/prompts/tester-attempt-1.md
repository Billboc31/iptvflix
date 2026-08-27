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