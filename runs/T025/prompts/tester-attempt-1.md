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