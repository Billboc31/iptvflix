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


# T022 — Build unified Series season and episode availability overview across sources

**Source**: GitHub Issue #39

## Description

## Objective

Make a Series detail page clearly summarize every known Season/Episode, watch progress and availability across configured sources, so users see the complete work rather than navigating provider-specific series entries.

## Context / Problem

For Series, source fragmentation is especially confusing: Plex may contain Seasons 1–3 while IPTV contains Seasons 1–5, and individual episodes may exist in different languages/qualities. IPTVFlix should present one canonical Series hierarchy and overlay availability/progress onto it.

## Included

- Extend canonical Series detail contracts/UI to present the known Series → Season → Episode hierarchy as one coherent structure.
- For each Season, show useful aggregate availability/completeness information (for example available episode count vs known episode count) without implying completeness when metadata is unknown.
- For each Episode, expose current availability across sources and variants using canonical availability contracts.
- Integrate existing viewing-progress state so watched/in-progress/next episode status is visible where reliable.
- Clearly distinguish known-but-unavailable episodes from episodes that are simply not known in metadata.
- Allow the UI to surface the preferred availability plus alternative variants when the resolver exists, without making the Series hierarchy source-specific.
- Keep the presentation usable for partial metadata and partially matched IPTV series.

## Acceptance Criteria

- [ ] One canonical Series page shows its known Seasons and Episodes rather than duplicate provider series structures.
- [ ] A Season can show `X/Y episodes available` when the total known episode count is reliable.
- [ ] An Episode can show availability from multiple configured sources without appearing multiple times in the episode list.
- [ ] Missing availability is visibly distinct from missing/unknown episode metadata.
- [ ] Existing watched/in-progress state is reflected in the episode hierarchy.
- [ ] Partial source coverage (for example Plex S1-S3 and IPTV S1-S5) is represented correctly.
- [ ] Language/quality variants do not duplicate Episode rows.
- [ ] Automated API/frontend tests cover full, partial, multi-source and unavailable episode cases.

## Excluded / Out of scope

- Video player implementation.
- Episode release notifications.
- Automatically downloading missing episodes.
- Rebuilding the metadata matching engine.

## Dependencies

Builds on #33 and benefits from #34/#35 for variant/preferred-availability presentation. Reuses the existing rich Series details and viewing-progress foundation.