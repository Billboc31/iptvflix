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


# T108 — Expand TMDB discovery catalog beyond current IPTV availability before recommendation embedding backfill

**Source**: GitHub Issue #211

## Description

## Context
IPTVFlix intentionally decouples **canonical catalog identity** from **playable availability**. A Movie/Series should exist in IPTVFlix even when no Xtream/Plex source currently provides a playable stream.

This is important for the product direction:
- discovery independent of IPTV;
- recommendations over the wider media universe;
- upcoming releases;
- `À surveiller` / `À ne pas rater`;
- My List before a title becomes playable;
- later notification when an existing canonical title gains an Availability;
- recommendation shelves that may be `WATCH_NOW`, `DISCOVERY`, `UPCOMING` or `UNAVAILABLE_HIGH_AFFINITY`.

#205 is about to build/has begun catalog embeddings. If this ticket lands after #205, that is still acceptable: #205 must support incremental/backfill embedding generation for the newly expanded catalog. Do NOT reset or duplicate the embedding architecture.

## Goal
Expand the canonical TMDB-backed catalog substantially beyond titles discovered through Xtream/Plex, while keeping `Availability` as a separate optional relation.

Target model:

```text
Canonical Catalog
  ├── Movie
  ├── Series
  ├── Seasons/Episodes
  ├── metadata / credits / keywords
  ├── future/upcoming titles
  └── recommendation embeddings
          │
          └── zero or more Availability rows
                 ├── Xtream
                 ├── Plex
                 └── future providers
```

A canonical title with **zero Availability rows remains a first-class discovery/recommendation entity**.

## 1. Audit current TMDB ingestion
Document the current catalog population rules:
- what is inserted during bootstrap;
- whether Movie/Series rows are created only from source matching;
- current discover/trending/popular imports;
- current pagination limits;
- whether upcoming content is stored;
- how much canonical catalog currently exists versus playable availability count.

Do not blindly add another TMDB importer if equivalent machinery already exists.

## 2. Discovery catalog policy
Define a configurable inclusion policy that gives IPTVFlix a large useful catalog without attempting to indiscriminately clone every obscure TMDB row.

Candidate feeds/signals to ingest, subject to current TMDB API capabilities/terms:
- popular Movies;
- popular TV Series;
- trending Movies/TV;
- now playing / current releases where applicable;
- upcoming Movies;
- on-the-air / upcoming/current Series;
- genre-based discovery pages;
- high-vote/high-popularity catalog pages;
- canonical titles referenced by recommendations/search/My List even if outside the bootstrap window.

Use multiple discovery dimensions so the catalog does not become only `popular this week`.

## 3. Breadth target and quality threshold
Make catalog breadth configurable.

Do not hard-code one arbitrary number, but support practical bootstrap targets such as tens of thousands of Movies/Series if API limits/runtime/storage make that reasonable.

Prefer useful discovery coverage over exhaustive garbage ingestion.

Possible configurable gates:
- minimum vote count/popularity floor for deep historical pages;
- language/region considerations;
- release date windows;
- include upcoming regardless of current availability;
- always retain titles already referenced by user state even if they later fall below import thresholds.

Do not delete canonical/user-referenced titles merely because a popularity threshold changes.

## 4. Canonical identity first
All imported TMDB titles must use the same canonical Movie/Series entities already used by Xtream matching.

When a source later contains the title:

```text
existing canonical TMDB Movie
        +
new Xtream match
        ↓
add Availability
```

Do NOT create a second duplicate Movie because it first entered through discovery and later through IPTV.

Reuse TMDB IDs as the primary external canonical match signal where available.

## 5. Rich metadata for recommendation use
Coordinate with #203/#205 so discovery titles retain enough normalized metadata for recommendation quality.

Where current catalog model supports it, bootstrap/enrich useful fields such as:
- title/original title;
- overview;
- release/first-air date;
- genres;
- runtime/episode runtime where available;
- original language;
- production countries;
- popularity;
- vote average/count;
- poster/backdrop;
- keywords/themes;
- collections/franchises;
- cast/crew/director/creators;
- networks for Series;
- external IDs;
- certification/maturity where available;
- status (`released`, `upcoming`, returning, ended, etc.).

Use staged/lazy enrichment for expensive detail endpoints rather than exploding TMDB calls during initial bootstrap.

## 6. Tiered enrichment
Separate cheap catalog discovery from expensive rich-detail enrichment.

Suggested tiers:

### Tier A — discovery seed
Enough data to create canonical identity and basic cards.

### Tier B — recommendation-enriched
Fetch details/keywords/credits/external IDs for titles likely to enter recommendation retrieval or high-value catalog segments.

### Tier C — on-demand deep enrichment
When user opens/searches/lists a less-enriched title, fill missing detail asynchronously/immediately as appropriate.

This avoids making a 50k-title bootstrap wait on multiple detail calls per title.

## 7. Search expansion
Current IPTVFlix search should remain capable of finding canonical titles not already in local DB by querying TMDB and importing them.

When a TMDB search result is selected/relevant:
- upsert canonical title;
- enrich it;
- make it immediately available to My List/recommendations;
- keep Availability empty until a provider matches.

Do not create temporary search-only objects that disappear.

## 8. Upcoming / future titles
Explicitly store upcoming titles useful for discovery.

Need enough metadata to support future shelves such as:
- `Sorties à venir pour vous`;
- `Films à ne pas rater`;
- `Séries bientôt disponibles`;
- `À surveiller`.

When release dates/status change, nightly/incremental TMDB sync should update the same canonical title.

## 9. Availability transitions
Ensure the system can efficiently detect the important transition:

```text
canonical title existed with 0 availability
             ↓
Xtream/Plex sync finds match
             ↓
Availability added
             ↓
playableNow changes false -> true
```

Emit/store enough state/event information for a future feature to notify a Profile that a watched/listed/recommended title became available.

Do not implement the full notification UX unless already in scope elsewhere.

## 10. Recommendation policy support
Expose/query catalog eligibility independently from availability so #207/#208/#210 can implement shelf modes like:
- `WATCH_NOW`: require household availability;
- `DISCOVERY`: availability optional;
- `UPCOMING`: future release/status;
- `WATCHLIST_CANDIDATE`: high profile affinity regardless of availability;
- `NEWLY_AVAILABLE`: title recently transitioned to playable.

Do not globally filter unavailable media out of Recommendation Engine candidate generation.

## 11. My List / profile state for unavailable titles
Ensure #201 profile state can reference canonical Movies/Series with no Availability.

User should be able to:
- open details;
- watch trailer/preview if metadata allows;
- add to My List;
- like/dislike where supported;
- receive recommendation/history interactions;
- later see `Lecture` automatically appear when an Availability is added.

No fake `Lecture` button when unavailable.

## 12. Bootstrap job
Provide an idempotent/resumable admin/bootstrap command/job.

Requirements:
- cursor/page progress persistence;
- bounded concurrency;
- TMDB rate-limit handling;
- retries/backoff;
- upsert, not duplicate;
- progress metrics;
- counts by Movie/Series/upcoming;
- safe resume after deployment interruption;
- can be run incrementally rather than requiring DB reset.

## 13. Incremental/nightly sync
After bootstrap, keep the discovery catalog fresh without re-downloading everything nightly.

Use sensible update groups:
- trending/current/upcoming titles refreshed frequently;
- recently changed/current Series refreshed reasonably often;
- older stable titles refreshed less frequently;
- titles in My List/recent recommendations/user interactions can receive priority refresh.

## 14. Interaction with #205 embeddings
This ticket may land before or after #205.

Required behavior either way:
- newly inserted discovery titles are eligible for embedding generation;
- enriched metadata changes invalidate/recompute embedding document when material;
- existing embeddings are NOT wiped unnecessarily;
- provide an idempotent embedding backfill trigger/queue for catalog rows missing #205 vectors.

If #205 has already completed, explicitly run/backfill embeddings for the expanded catalog and report counts.

## 15. Storage / scale diagnostics
Add diagnostics for:
- canonical Movie count;
- canonical Series count;
- Episode count;
- titles with at least one Availability;
- titles with zero Availability;
- upcoming titles;
- recommendation-enriched titles;
- titles with embeddings (when #205 exists);
- TMDB sync age/coverage.

This lets us know whether Recommendation Engine is operating on 3k IPTV titles or a true discovery catalog.

## 16. TMDB terms / image behavior
Continue respecting TMDB API attribution/cache/image requirements used by the project. Do not bulk-download unnecessary image binaries into DB unless existing architecture intentionally does so; storing TMDB image paths/metadata is preferred where appropriate.

## Tests
Cover at minimum:
- discovery import creates canonical title with zero Availability;
- later Xtream match adds Availability to same canonical title;
- rerunning bootstrap does not duplicate;
- search imports missing TMDB title canonically;
- unavailable title can be added to profile My List;
- upcoming title updates release/status;
- recommendation query can include unavailable title when policy permits;
- `WATCH_NOW` policy excludes it until Availability exists;
- newly inserted title enters embedding backlog when #205 is present.

## Acceptance criteria
- [ ] Canonical catalog is no longer limited to titles found in IPTV/Plex sources.
- [ ] Large configurable TMDB discovery bootstrap exists for Movies and Series.
- [ ] Upcoming/future content is persisted.
- [ ] Canonical titles with zero Availability are first-class objects.
- [ ] Source sync later attaches Availability without creating duplicate media.
- [ ] Search can import missing TMDB titles into canonical DB.
- [ ] Rich recommendation metadata is stored/enriched in tiers.
- [ ] Incremental sync keeps current/upcoming catalog fresh.
- [ ] My List/profile interactions work for unavailable titles.
- [ ] Recommendation Engine can distinguish discovery vs watch-now eligibility.
- [ ] #205 embeddings can be incrementally/backfilled for expanded catalog regardless of implementation order.
- [ ] Diagnostics clearly show total catalog vs playable catalog coverage.
- [ ] No DB reset is required.

## Completion rule
Do not close because one TMDB discover endpoint was called. Demonstrate a meaningful expanded canonical catalog containing real Movies/Series that have NO IPTV Availability, show one of them in normal IPTVFlix detail/My List flow, then run/trigger a source match for a previously unavailable canonical title and prove that it gains an Availability without changing/duplicating its canonical identity. If #205 already exists, prove newly imported catalog rows also receive embeddings through incremental/backfill processing.