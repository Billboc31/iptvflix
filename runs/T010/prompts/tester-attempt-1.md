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


# T010 — Integrate external movie and series metadata enrichment

**Source**: GitHub Issue #19

## Description

## Objective

Enrich canonical Movies and Series with reliable external metadata so IPTVFlix can present a high-quality streaming-style catalog independent of the poor metadata often supplied by IPTV providers.

## Context / Problem

Xtream sources may provide incomplete, inconsistent or low-quality titles, posters, descriptions and classification data. IPTVFlix needs a dedicated enrichment layer that augments canonical catalog entities without coupling them to one IPTV provider or overwriting useful source information irreversibly.

## Included

- Add an external metadata provider abstraction for Movies and Series.
- Implement one initial metadata provider supported by the chosen project configuration.
- Retrieve and persist useful metadata such as canonical title, original title, release year/date, synopsis, poster/backdrop references, genres, runtime where available, external IDs and selected rating/popularity fields when permitted by the provider.
- Keep external metadata provenance explicit so provider data can be refreshed/replaced later.
- Add configuration for provider credentials/API keys through environment/secrets handling.
- Add retry/error handling and rate-limit-aware behavior appropriate to the provider.
- Add a refresh mechanism that avoids repeatedly fetching unchanged metadata unnecessarily.
- Preserve the separation between IPTV source availability and canonical/external metadata.

## Acceptance Criteria

- [ ] Canonical Movies and Series can be enriched through an external metadata provider without exposing IPTV-specific models to the enrichment layer.
- [ ] Metadata credentials are configurable through secrets/environment and never committed or returned to clients.
- [ ] Enriched records persist external identifiers and metadata provenance.
- [ ] Poster/backdrop/synopsis/genre/release information is available through canonical API contracts when enrichment succeeds.
- [ ] Provider failures do not make the underlying IPTV catalog unavailable.
- [ ] Re-running enrichment avoids unnecessary duplicate work for already-current records.
- [ ] Automated tests use mocked/provider fixtures and do not require live external API credentials.

## Excluded / Out of scope

- Fuzzy title matching strategy between raw IPTV names and external titles beyond the minimal provider lookup boundary required here.
- Recommendation scoring.
- Cinema radar.
- Playback.

## Dependencies

Builds on the canonical catalog from Batch 1. Can run in parallel with the end-to-end stabilization ticket #17; the matching ticket will consume this provider boundary.