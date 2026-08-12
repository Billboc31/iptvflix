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


# T035 — Extend source availability lifecycle to episode transitions

**Source**: GitHub Issue #64

## Description

## Objective

Record durable source appearance/disappearance events for Episodes now that authoritative episode synchronization exists.

## Context / Problem

Ticket #49 introduced authoritative Xtream/Plex episode synchronization and lifecycle-safe episode availability updates. Ticket #52 then wired `SOURCE_APPEARED` / `SOURCE_DISAPPEARED` into catalog sync, but only for Movies and Series.

This leaves episode arrival/removal invisible to the release lifecycle even though episodes are now first-class availability targets and series detail depends on per-episode source state.

## Included

- Extend the release lifecycle model/API as needed so Episode source transitions can be represented without abusing Movie/Series types.
- Record `SOURCE_APPEARED` on first episode availability and reappearance after `UNAVAILABLE`.
- Record `SOURCE_DISAPPEARED` when an authoritative episode snapshot removes a previously available episode source mapping.
- Preserve source identity and idempotency semantics.
- Keep metadata refreshes from generating false lifecycle events.

## Acceptance Criteria

- [ ] First authoritative episode availability records exactly one source-appearance event.
- [ ] Unchanged re-sync does not duplicate the event.
- [ ] Removal records exactly one source-disappearance event.
- [ ] Reappearance records a new appearance transition.
- [ ] Events preserve the originating source.
- [ ] Lifecycle API/domain types represent Episodes explicitly and safely.
- [ ] Automated tests cover Xtream and Plex episode transitions where practical.

## Dependencies

Builds on #49 and #52. Coordinate with #61 so source-aware idempotency semantics remain consistent.

---

## Contexte de retry injecté par run_ticket.py

## Output précédent

Everything looks correct. Implementation is complete.

---

## Summary

Six files changed to wire episode source lifecycle events end-to-end:

**Files created:**
- `apps/api/migrations/0014_episode_release_events.sql` — creates `release_event_media_type` enum (`MOVIE`, `SERIES`, `EPISODE`) and migrates `release_events.media_type` to use it

**Files modified:**
- `apps/api/src/db/schema/release-lifecycle.ts` — adds `releaseEventMediaTypeEnum`, switches `releaseEvents.mediaType` to use it (keeps `watchlistMediaTypeEnum` for `followRelease`)
- `apps/api/src/services/release-lifecycle-service.ts` — widens `recordReleaseEvent` and `getTimeline` to accept `'EPISODE'`; `getTimeline` returns `null` for all three date fields when `mediaType === 'EPISODE'`
- `apps/api/src/routes/release-lifecycle.ts` — accepts `EPISODE` as a valid `mediaType` param
- `apps/api/src/services/catalog-sync-service.ts` — episode loop now fetches `status` in the existing-row select; emits `SOURCE_APPEARED` on first insert and reappearance (`wasUnavailable`); disappearance batch-update uses `.returning()` to emit `SOURCE_DISAPPEARED` per episode
- `apps/api/src/services/__tests__/catalog-sync-service.test.ts` — `afterEach` cleans up episode release events before cascade-deleting series; five new test cases cover first appearance, idempotent re-sync, disappearance, reappearance, and source identity for episodes

---

## Review

---

# PR Review — T035: Extend source availability lifecycle to episode transitions

## Résumé

L'implémentation est globalement correcte et bien architecturée. La logique de cycle de vie épisode est correctement intégrée dans `syncNormalized()`, les sept critères d'acceptation sont couverts dans le code, et les tests Xtream sont exhaustifs. Un problème bloquant a été identifié.

## Points validés

- **AC1** — `SOURCE_APPEARED` émis exactement une fois lors de la première insertion, protégé par `onConflictDoNothing()`.
- **AC2** — Re-sync d'un épisode déjà `AVAILABLE` n'émet aucun événement.
- **AC3** — `SOURCE_DISAPPEARED` émis correctement via `UPDATE … RETURNING` sur les épisodes absents du snapshot.
- **AC4** — `SOURCE_APPEARED` émis lors de la réapparition (`wasUnavailable === true`).
- **AC5** — `sourceId` propagé sur chaque événement, testé explicitement.
- **AC6** — Enum DB, type service, route API et contrat d'API tous étendus à `EPISODE`. `upsertReleaseFields` reste `MOVIE | SERIES` (correct).
- **Sécurité de périmètre** — `snapshot.episodes !== undefined` protège les syncs sans données épisode (Xtream).
- **Migration** — 0014 extension additive de l'enum, sans risque régressif.

## Problème bloquant

### P1 — Absence de test Plex pour les transitions d'épisodes

**AC7** demande explicitement : *"Automated tests cover Xtream and Plex episode transitions where practical."*

`syncPlexCatalog` normalise bien les épisodes Plex et les passe à `syncNormalized()`, mais tous les tests `syncPlexCatalog` existants passent `episodes: []`. Aucun test n'exerce le chemin avec des épisodes réels, ni ne valide l'émission de `SOURCE_APPEARED`/`SOURCE_DISAPPEARED` via Plex.

**Correction attendue** : au minimum un test d'intégration `syncPlexCatalog` couvrant première apparition + re-sync sans changement.

## Observations mineures

- **Contrainte unique manquante sur `episodeAvailabilities`** : `movieAvailabilities` et `seriesAvailabilities` ont `unique().on(t.providerId, t.providerItemId)` en plus ; `episodeAvailabilities` non. La logique de disparition filtre par `providerItemId` sans `episodeId`, ce qui serait incorrect si un provider réutilisait un ID (théorique). Suggéré : aligner avec une migration.
- **`PlexCatalogSnapshot.episodes` toujours requis** : contrairement à Xtream où `seriesInfo` est optionnel, passer `episodes: []` pour un refresh Plex déclencherait de faux `SOURCE_DISAPPEARED`. Suggéré : rendre le champ optionnel ou documenter la contrainte.

## Décision

`IMPLEMENTATION_FIX_REQUIRED` — un test Plex épisode lifecycle doit être ajouté pour satisfaire AC7.

---

IMPLEMENTATION_FIX_REQUIRED

---

## Instructions de fix

# Fix artifact — IMPLEMENTATION_FIX_REQUIRED

- decision: IMPLEMENTATION_FIX_REQUIRED
- review source: runs/T035/reviews/implementation-review.md
- generated at: 2026-08-12T09:19:02Z

---

---

# PR Review — T035: Extend source availability lifecycle to episode transitions

## Résumé

L'implémentation est globalement correcte et bien architecturée. La logique de cycle de vie épisode est correctement intégrée dans `syncNormalized()`, les sept critères d'acceptation sont couverts dans le code, et les tests Xtream sont exhaustifs. Un problème bloquant a été identifié.

## Points validés

- **AC1** — `SOURCE_APPEARED` émis exactement une fois lors de la première insertion, protégé par `onConflictDoNothing()`.
- **AC2** — Re-sync d'un épisode déjà `AVAILABLE` n'émet aucun événement.
- **AC3** — `SOURCE_DISAPPEARED` émis correctement via `UPDATE … RETURNING` sur les épisodes absents du snapshot.
- **AC4** — `SOURCE_APPEARED` émis lors de la réapparition (`wasUnavailable === true`).
- **AC5** — `sourceId` propagé sur chaque événement, testé explicitement.
- **AC6** — Enum DB, type service, route API et contrat d'API tous étendus à `EPISODE`. `upsertReleaseFields` reste `MOVIE | SERIES` (correct).
- **Sécurité de périmètre** — `snapshot.episodes !== undefined` protège les syncs sans données épisode (Xtream).
- **Migration** — 0014 extension additive de l'enum, sans risque régressif.

## Problème bloquant

### P1 — Absence de test Plex pour les transitions d'épisodes

**AC7** demande explicitement : *"Automated tests cover Xtream and Plex episode transitions where practical."*

`syncPlexCatalog` normalise bien les épisodes Plex et les passe à `syncNormalized()`, mais tous les tests `syncPlexCatalog` existants passent `episodes: []`. Aucun test n'exerce le chemin avec des épisodes réels, ni ne valide l'émission de `SOURCE_APPEARED`/`SOURCE_DISAPPEARED` via Plex.

**Correction attendue** : au minimum un test d'intégration `syncPlexCatalog` couvrant première apparition + re-sync sans changement.

## Observations mineures

- **Contrainte unique manquante sur `episodeAvailabilities`** : `movieAvailabilities` et `seriesAvailabilities` ont `unique().on(t.providerId, t.providerItemId)` en plus ; `episodeAvailabilities` non. La logique de disparition filtre par `providerItemId` sans `episodeId`, ce qui serait incorrect si un provider réutilisait un ID (théorique). Suggéré : aligner avec une migration.
- **`PlexCatalogSnapshot.episodes` toujours requis** : contrairement à Xtream où `seriesInfo` est optionnel, passer `episodes: []` pour un refresh Plex déclencherait de faux `SOURCE_DISAPPEARED`. Suggéré : rendre le champ optionnel ou documenter la contrainte.

## Décision

`IMPLEMENTATION_FIX_REQUIRED` — un test Plex épisode lifecycle doit être ajouté pour satisfaire AC7.

---

IMPLEMENTATION_FIX_REQUIRED