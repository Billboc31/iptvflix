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


# T092 — Make Series episodes directly playable with per-episode availability/source selection

**Source**: GitHub Issue #192

## Description

## Context
Series detail pages now correctly show seasons and episodes, but an episode cannot reliably be chosen and played according to its actual available Xtream/Plex sources.

Catalog structure and playback need to be connected at EPISODE level, not only Series level.

## Goal
From a Series detail page, the user must be able to select a season, see its episodes, and play a specific episode using that episode's own availability variants.

## Required behavior
For each episode:
- show episode number/title/overview/artwork where available;
- determine whether it has 0, 1 or N playable availabilities;
- show `Lecture` when at least one playable availability exists;
- hide/disable play clearly when no source exists;
- allow source/quality/language selection when multiple availabilities exist;
- default intelligently to the best/preferred availability;
- pass the episode canonical ID + selected availability into the existing playback resolver/player;
- save progress against that exact episode;
- next/previous episode must resolve availability for the destination episode, not reuse the previous stream accidentally.

## Multi-source example
```text
S01E03 — Episode title

Disponible :
✓ Français • 1080p • Source A
  Français • 720p • Source B
  VO • 4K • Source C

▶ Lecture
```

The UI should stay compact; source choice can be in a menu/dropdown rather than cluttering every episode card.

## Canonical model
Keep Series/Season/Episode canonical TMDB entities independent from provider streams.

Episode availability must join canonical episode -> provider/source variant. Do not create duplicate episodes per source.

If an Xtream source has episode metadata that failed to attach to the canonical episode, investigate/fix that mapping rather than falling back to series-level availability.

## Acceptance criteria
- [ ] User can pick a season and a specific episode.
- [ ] Each episode independently knows whether it is playable.
- [ ] `Lecture` on SxxExx launches that exact episode.
- [ ] Multiple source/quality/language variants can be selected for one episode.
- [ ] Best/preferred source is selected by default.
- [ ] Episodes without source remain visible but are not falsely playable.
- [ ] Progress/resume is stored per episode.
- [ ] Next episode resolves the correct next episode availability.
- [ ] No duplicate episode cards are created because of multiple providers.
- [ ] Tested with a real Series containing several seasons and real Xtream episode availabilities.

## Completion rule
Do not close because seasons/episodes merely render. Manually click `Lecture` on at least two different real episodes and prove the correct streams open.