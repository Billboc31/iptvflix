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


# T074 — Populate canonical TV seasons and episodes from TMDB independently of sources

**Source**: GitHub Issue #152

## Description

## Context
IPTVFlix is now TMDB-first: canonical media exists independently from Xtream/Plex availability. However, series can currently have a canonical show page while seasons/episodes are missing until source data is present. That violates the new model and blocks the immersive Series detail experience (#150).

## Core rule
TMDB defines the canonical TV hierarchy. A Series MUST be able to exist as:

Series → Seasons → Episodes

with ZERO playable sources anywhere in that hierarchy. Xtream/Plex only attach availability/variants to the matching canonical show/season/episode later.

## Goal
Extend the TMDB catalog bootstrap/enrichment/refresh pipeline so imported canonical TV shows have their TMDB seasons and episodes populated locally, with rich enough metadata for browsing before any source import.

## Requirements

### Canonical hierarchy
For every eligible imported TMDB show, persist canonical seasons and episodes using stable TMDB identities and existing relational tables/models. Do not create episodes from Xtream identity.

Support normal seasons, season 0 / specials, miniseries, currently airing shows, future announced seasons/episodes, missing/partial TMDB metadata, and shows whose hierarchy changes later.

### Season metadata
Persist useful available metadata such as TMDB season id, season number/name, overview, poster path, air date, episode count and sync timestamps/provenance where compatible with the existing schema.

### Episode metadata
Persist useful available metadata such as TMDB episode id, season/episode number, localized title, original title where useful, overview, still image path, air date, runtime, vote/rating and other existing canonical fields useful to the UI. Do not store image binaries.

### Bootstrap integration
The catalog bootstrap introduced by the TMDB-first pivot must populate TV hierarchy without requiring Xtream/Plex first.

Do not make bootstrap fragile by serially fetching an unlimited number of endpoints with no controls. Implement sensible concurrency/rate-limit handling, retries/backoff, progress accounting and resumability/idempotency consistent with the existing bootstrap architecture.

If fully hydrating every episode for the entire initial long-tail catalog would make bootstrap impractical, implement a deliberate scalable strategy: prioritize relevant/popular/current catalog during bootstrap and support deferred/on-demand hydration for remaining shows. The end-user invariant remains that opening/browsing a canonical show can obtain its canonical seasons/episodes without any playable source.

### On-demand enrichment
When a canonical Series is opened/searched/imported and its season/episode hierarchy is absent or stale, the backend should be able to hydrate/refresh it from TMDB. Avoid requiring a full global bootstrap rerun.

### Scheduled refresh
Integrate with the existing TMDB refresh scheduler. Current/upcoming/airing shows should refresh more frequently than completed old shows. Detect newly announced seasons/episodes and metadata changes without destructive duplication.

### Xtream/Plex attachment
Source sync must resolve incoming series/episode streams against the canonical hierarchy and attach availability/variants. It must NOT be the mechanism responsible for creating the canonical hierarchy. Existing matching improvements should be reused.

### Idempotency and reconciliation
Repeated bootstrap/refresh/hydration must not duplicate seasons or episodes. Upsert using stable TMDB identities/natural hierarchy constraints as appropriate. Preserve user state such as episode progress/watched state and existing valid availability links during metadata refresh.

### API/UI readiness
Ensure the existing/new Series detail API can return canonical seasons/episodes even when all have `sources = []`. #150 should be able to render season selectors and episode cards before Xtream import.

## Acceptance criteria
- [ ] A TMDB-imported Series can have seasons and episodes before any source is configured.
- [ ] Seasons/episodes use canonical TMDB identity rather than Xtream identity.
- [ ] Series with zero playable sources still return their hierarchy through the API.
- [ ] Bootstrap populates or schedules hydration of TV hierarchy according to a documented scalable strategy.
- [ ] Opening/enriching a missing or stale show can hydrate hierarchy from TMDB without rerunning the global bootstrap.
- [ ] Scheduled refresh discovers new seasons/episodes for ongoing shows.
- [ ] Specials/season 0, miniseries, upcoming and partially populated shows are handled gracefully.
- [ ] Repeated hydration is idempotent and creates no duplicates.
- [ ] Refresh does not destroy playback progress, watched state or valid source availability.
- [ ] Xtream/Plex attach variants to canonical episodes instead of defining the hierarchy.
- [ ] TMDB rate limits/retries/concurrency are handled safely.
- [ ] Progress/observability makes large hierarchy hydration diagnosable.
- [ ] Automated tests cover source-free shows, hierarchy hydration, refresh and idempotency.

## Dependency / UX
This is backend/catalog groundwork for #150 `Immersive modal Movie & Series detail experience`. The desired UI is: canonical Series → season selector → rich episode list, regardless of whether any episode is currently playable.