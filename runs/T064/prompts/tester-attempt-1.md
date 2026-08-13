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


# T064 — Pivot IPTVFlix to a TMDB-first canonical catalog architecture

**Source**: GitHub Issue #131

## Description

## Goal
Make TMDB the canonical media catalog. Xtream, Plex and future providers become availability/variant sources attached to canonical movies, shows and episodes.

Core rule: TMDB describes what media exists; IPTVFlix owns discovery/user state; providers describe where/how it can be played.

## Architecture
Prefer one PostgreSQL instance initially with a strong logical catalog/application boundary that can be extracted later. Do not duplicate full canonical metadata into app tables.

A canonical movie/show must be allowed to exist with zero playable sources. Multiple provider/language/quality variants must attach to one canonical entity.

Support movies and TV hierarchy (show → season → episode). Keep enough localized metadata for a premium streaming UI: titles, overview, dates, status, genres, posters/backdrops paths, runtime, popularity/votes, languages/countries, collections, useful credits/keywords/external IDs and sync provenance/timestamps.

Do not store TMDB image binaries locally; store paths/metadata.

## Migration
Existing media details, source variants, watchlist, history/progress, shelves and recommendations must migrate/reconcile onto canonical entities rather than being discarded.

## Acceptance criteria
- Canonical identity uses TMDB identity where available.
- Media with zero sources are first-class catalog entities.
- Multiple Xtream/Plex/future variants can attach to one item.
- TV hierarchy exists independently of source availability.
- Model is ready for a large local catalog.
- Existing user state can migrate to canonical entities.
- Adding another provider does not require redesigning Movie/Show.
- Follow-up tickets can land incrementally without maintaining two competing identity models long-term.