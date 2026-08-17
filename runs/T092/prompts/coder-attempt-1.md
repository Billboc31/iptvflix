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