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


# T034 — Enforce maxVideoQuality as a real playback cap

**Source**: GitHub Issue #62

## Description

## Objective

Make `maxVideoQuality` behave as an actual upper playback limit when resolving the preferred availability.

## Context / Problem

The profile UI presents this field as **Qualité vidéo maximale**, but the current resolver only clamps the quality score. A 4K variant can therefore tie with a 1080p variant when the configured maximum is 1080p and still win on the deterministic id tie-break.

That means the selected variant may exceed the user's configured maximum.

## Included

- Define and enforce clear maximum-quality semantics in the backend availability resolver.
- Keep unknown-quality variants usable as deterministic fallbacks when appropriate instead of silently discarding them without a defined rule.
- Preserve the existing priority order between language, subtitles, source preference and quality unless explicitly required by the cap semantics.
- Ensure the frontend continues to rely on backend resolution rather than duplicating the rule.

## Acceptance Criteria

- [ ] With `maxVideoQuality = 1080p`, a known 4K-only candidate is not selected over an otherwise usable candidate at or below 1080p.
- [ ] 720p/1080p/4K caps behave consistently.
- [ ] `maxVideoQuality = null` keeps the current no-limit behavior.
- [ ] Unknown quality has documented deterministic fallback behavior.
- [ ] Existing language/source priority semantics remain intact.
- [ ] Automated tests cover above-cap, below-cap, no-cap, unknown-quality and tie scenarios.

## Dependencies

Builds on the availability resolver introduced by #35.