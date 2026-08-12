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


# T025 — Reuse canonical Series identity when syncing Plex and other providers

**Source**: GitHub Issue #50

## Description

## Objective

Ensure Series discovered from Plex or future sources are matched/reused as existing canonical Series whenever possible instead of creating duplicate canonical works per provider.

## Context / Problem

The current shared sync path resolves Movies through canonical identity evidence such as TMDB, but the Series path inserts a new canonical `series` row whenever a provider availability does not already exist. This means the same Series can become duplicated when it is already known from Xtream and later appears on Plex.

That violates the core product invariant: one canonical work, many source availabilities.

## Included

- Add a provider-independent canonical Series resolution step before inserting a new Series.
- Reuse reliable external identifiers from provider metadata when available (for example TMDB/other supported IDs).
- Reuse the existing Series matching/enrichment boundary for noisy/localized provider names where appropriate rather than introducing Plex-only matching rules.
- Persist the new provider item as another `series_availability` linked to the existing canonical Series when a confident match exists.
- Preserve ambiguous/low-confidence cases as unmatched/new candidates according to the existing matching policy rather than force-merging unrelated Series.
- Make the same resolution boundary reusable for future provider adapters.
- Ensure repeated sync is idempotent and does not create additional canonical Series rows.

## Acceptance Criteria

- [ ] A Series already known from Xtream can gain a Plex availability without creating a second canonical Series when reliable identity evidence matches.
- [ ] A Plex-only Series can still create/enter the canonical catalog when no existing canonical match is found.
- [ ] Matching does not rely on Plex-specific logic inside the canonical domain.
- [ ] Ambiguous same-title Series are not silently merged without sufficient evidence.
- [ ] Re-running the same Plex sync does not create duplicate canonical Series or duplicate availability mappings.
- [ ] Movie and Series resolution follow consistent provider-independent identity principles.
- [ ] Automated tests cover existing-Series reuse, Plex-only Series, same-title ambiguity and repeat synchronization.

## Excluded / Out of scope

- Full Season/Episode availability ingestion; tracked separately.
- Manual metadata correction UI.
- Recommendation logic.

## Dependencies

Builds on the existing title matching/external metadata pipeline and the Plex provider adapter.