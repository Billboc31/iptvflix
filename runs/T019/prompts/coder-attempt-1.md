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


# T019 — Add universal external catalog discovery for unavailable and upcoming media

**Source**: GitHub Issue #36

## Description

## Objective

Allow users to discover and open canonical Movies/Series that are not currently present on any configured source, including announced/upcoming titles, instead of treating the configured IPTV catalog as the universe of searchable content.

## Context / Problem

IPTVFlix should answer a search for a known upcoming movie even when it has no IPTV/Plex availability. Users need to be able to discover the work, inspect its metadata/release information and later track it. The existing search operates over the local canonical catalog and should remain fast while gaining an external discovery fallback.

## Included

- Add an external-catalog discovery boundary using the existing metadata provider abstraction where appropriate.
- When local canonical search has insufficient/no results, allow discovery of external Movies/Series not yet persisted locally.
- Materialize/persist a canonical Media record when the user opens, saves or otherwise needs to track an external result, without fabricating an availability.
- Represent `availableToMe=false` / zero availabilities clearly in API and web UI.
- Support upcoming/announced media metadata and known release dates/status when the metadata provider exposes them.
- Keep local search results and externally discovered results deduplicated by canonical/external identity.
- Avoid turning ordinary search into an uncontrolled full-database import or excessive provider API usage.
- Handle metadata provider failure/rate limiting without breaking local catalog search.

## Acceptance Criteria

- [ ] Searching for a known Movie not present on any configured source can return an external discovery result.
- [ ] Opening/saving that result can create/reuse one canonical Media with zero availabilities.
- [ ] A future/upcoming title can have a useful detail page even when it is not yet released or available to the user.
- [ ] Local and external results for the same canonical work are not displayed as duplicates.
- [ ] External provider failure still leaves local catalog search usable.
- [ ] The UI clearly distinguishes `not available to me` from `not found`.
- [ ] Provider API calls are bounded/cached appropriately for interactive search.
- [ ] Automated tests cover local hit, external-only hit, upcoming title, deduplication, zero availability and provider failure.

## Excluded / Out of scope

- Importing every external movie/series into the local database.
- Release-follow notifications.
- Recommendation ranking.
- Availability on commercial streaming services not configured as sources.

## Dependencies

Requires the zero-availability canonical model from #33 and uses the existing external metadata provider/enrichment boundary.