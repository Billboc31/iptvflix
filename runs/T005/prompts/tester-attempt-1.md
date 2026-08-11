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


# T005 — Implement Xtream Codes catalog ingestion

**Source**: GitHub Issue #6

## Description

## Objective
Implement an Xtream Codes provider adapter that can authenticate against a configured source and retrieve VOD/series catalog data for later normalization into the IPTVFlix canonical catalog.

## Context / Problem
Xtream Codes is the first supported IPTV source type. Provider-specific API contracts must remain isolated from the IPTVFlix domain so later M3U support and other providers do not force UI or domain changes.

## Included
- Implement an Xtream Codes client/provider adapter using configured source credentials.
- Retrieve the provider data required for the first Movies and Series vertical slice, including categories and episode/season information when exposed by the provider.
- Map raw provider responses into an ingestion-layer representation, not directly into frontend models.
- Handle authentication failures, malformed responses, network errors, timeouts, and large catalogs robustly.
- Avoid logging credentials or stream URLs containing credentials.
- Add fixture-based/provider-contract tests so ingestion behaviour can be tested without a live IPTV account.

## Acceptance Criteria
- [ ] A valid configured Xtream source can retrieve movie and series catalog data.
- [ ] Provider DTOs/contracts are isolated from the canonical media domain.
- [ ] Authentication and network failures produce sanitized, actionable errors.
- [ ] Credentials are never exposed in logs or API error payloads.
- [ ] Large provider responses are handled without obviously unsafe unbounded application behaviour.
- [ ] Tests cover representative movies, series, categories, malformed responses, and authentication failure.
- [ ] The adapter exposes a clear boundary that catalog synchronization can consume.

## Excluded / Out of scope
- Canonical media matching/enrichment.
- Persisting the full catalog into IPTVFlix entities.
- M3U ingestion.
- Playback.

## Dependencies
Requires #5 for configured Xtream sources and the common foundation from #2. It can be developed largely in parallel with the canonical catalog work in #4 as long as the provider/domain boundary remains respected.