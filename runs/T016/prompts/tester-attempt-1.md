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


# T016 — Evolve the canonical catalog to support media with zero or many availabilities

**Source**: GitHub Issue #33

## Description

## Objective

Evolve the existing canonical catalog so a Movie, Series, Season or Episode has an identity and lifecycle independent from configured content sources, while retaining zero, one or many source availabilities.

## Context / Problem

Batch 1/2 established canonical Movies/Series and source availability mappings. IPTVFlix now needs to become a universal library: an upcoming movie may be discoverable and tracked before it exists on IPTV, while an existing work may simultaneously be available on Xtream and Plex. Source disappearance must not delete the canonical work.

## Included

- Review and evolve the existing canonical persistence/API model rather than replacing it blindly.
- Ensure canonical Movies and Series can exist without any configured-source availability.
- Preserve the Series → Season → Episode hierarchy and allow episode-level availability where appropriate.
- Ensure availability records remain source/provider mappings and do not define canonical identity.
- Support multiple concurrent availabilities for the same canonical work/episode.
- Preserve existing Batch 1/2 canonical IDs and user-state references where reasonably possible through safe migrations.
- Expose explicit availability state/count information through canonical API contracts without provider DTO leakage.
- Ensure source disappearance/removal can leave useful canonical metadata, watchlist/history and release tracking intact.

## Acceptance Criteria

- [ ] A canonical Movie can exist and be returned by the canonical API with zero availabilities.
- [ ] A canonical Series and its known Season/Episode hierarchy can exist with zero availabilities.
- [ ] One canonical Movie/Episode can reference multiple availabilities from different sources.
- [ ] Removing or losing an availability does not delete canonical metadata or user tracking for the work.
- [ ] Existing canonical references used by watchlist/history remain valid or are migrated deterministically.
- [ ] Provider-specific identifiers remain confined to source/availability mappings.
- [ ] Database constraints prevent obvious duplicate mappings while permitting legitimate variants.
- [ ] Automated migration/domain/API tests cover zero, one and multiple availability cases plus disappearance.

## Excluded / Out of scope

- Importing the entire external movie database.
- Plex ingestion itself.
- Language/quality preference resolution.
- Release notifications.

## Dependencies

Must follow the universal-domain invariants documented by #32. Builds on the existing canonical catalog and metadata/matching implementation.