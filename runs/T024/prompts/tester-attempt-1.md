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


# T024 — Fix episode availability lifecycle and provider episode synchronization

**Source**: GitHub Issue #49

## Description

## Objective

Prevent catalog synchronization from falsely marking every Episode availability as unavailable, and make episode-level availability lifecycle reflect the actual provider snapshot.

## Context / Problem

The current shared catalog synchronization logic reads all AVAILABLE `episode_availabilities` for a source, but the normalized snapshot contains no episode-level items. It therefore treats the entire prior episode set as missing and marks every Episode availability `UNAVAILABLE` on each sync.

This directly breaks the new canonical Series → Season → Episode experience and makes multi-source episode completeness unreliable.

## Included

- Remove the current behavior that treats an absent episode collection in a provider snapshot as an authoritative empty episode catalog.
- Distinguish between:
  - provider snapshots that do not contain episode data;
  - provider snapshots that intentionally contain a complete episode inventory.
- Extend the common provider ingestion/synchronization boundary to carry episode-level items where the provider supports them.
- For Xtream, use available Season/Episode catalog information to create/update Episode availability mappings where supported by the existing provider client.
- For Plex, ingest the Season/Episode hierarchy and episode provider identities needed for canonical episode availability.
- Track Episode `firstSeenAt`, `lastSeenAt`, disappearance and reappearance using the same idempotent lifecycle principles as Movie/Series availability.
- Do not mark existing Episode availability stale unless the synchronization run has authoritative episode coverage for that source/scope.
- Keep provider-specific payloads inside adapters/ingestion boundaries.

## Acceptance Criteria

- [ ] Synchronizing a source snapshot that contains no episode inventory does not mark existing Episode availabilities `UNAVAILABLE` merely because the episode list is absent.
- [ ] When an authoritative Episode snapshot is available, observed Episodes remain/become `AVAILABLE` and missing Episodes can be marked `UNAVAILABLE` correctly.
- [ ] Repeated synchronization preserves Episode `firstSeenAt` and updates `lastSeenAt` without creating duplicates.
- [ ] A disappeared Episode can become available again without losing useful history.
- [ ] Xtream Episode data is mapped to the canonical Series → Season → Episode hierarchy where provider data supports it.
- [ ] Plex Episode data is mapped through the common ingestion boundary rather than a Plex-specific UI/domain model.
- [ ] Automated tests cover snapshot-without-episodes, complete episode snapshot, disappearance, reappearance and multi-source Episode availability.

## Excluded / Out of scope

- Episode playback.
- Episode release notifications.
- Rebuilding the Series detail UI itself.

## Dependencies

Builds on the existing canonical availability model and the Plex/Xtream provider adapters. The Series multi-source overview should consume the corrected lifecycle.