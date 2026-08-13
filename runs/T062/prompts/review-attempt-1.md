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

# Role — Reviewer

## Mission

Vérifier qu’une implémentation respecte :
- le ticket
- le plan
- les conventions
- l’architecture
- les contraintes sécurité/qualité

## Tu dois

- détecter les dérives de scope
- détecter les violations architecture
- vérifier les impacts potentiels
- vérifier la cohérence mémoire/documentation
- proposer des corrections concrètes

## Tu ne dois pas

- réécrire complètement le code
- introduire un nouveau scope
- accepter des comportements implicites dangereux

## Sortie attendue

Une review structurée conforme à `ai/templates/pr-review-template.md`.

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

# Generic Review Task

Read the ticket below and review the implementation produced for it.

The review must cover:
- correctness relative to the ticket requirements
- scope compliance
- code quality and safety
- blocking issues vs minor observations

The ticket follows.


# T062 — Ingest and reconcile canonical Series → Season → Episode structure with playable episode availabilities

**Source**: GitHub Issue #124

## Description

## Objective

Make IPTVFlix Series fully usable by building and maintaining the canonical hierarchy `Series → Season → Episode → Availability` from Xtream/provider data, enriched with TMDB metadata, so a matched Series detail page actually exposes its seasons, episodes and playable source variants.

The desired invariant is:

> `Series`, `Season` and `Episode` describe the canonical artwork structure. Provider/Xtream streams describe **Availability** of episodes, not the canonical episode identity.

## Observed problem

The current application can successfully identify/enrich some Series at the Series level: poster, release year and synopsis are present. However, the Series detail page can still show **“Les saisons ne sont pas encore disponibles”** even though the IPTV provider contains the series/episode streams.

Observed example during local product testing:

- provider title displayed as `4K-A+ - Amber Brown`;
- poster, year (2022) and synopsis are successfully enriched, indicating the Series itself was identified;
- one provider/version badge is present;
- no Season or Episode records are exposed on the detail page;
- therefore there is currently no usable `Series → Season → Episode → playable stream` experience.

The dirty canonical title is also visible in this example. Canonical title cleanup/matching is primarily addressed by #122/#123; this ticket must consume the canonical identity produced by that work and must not reintroduce provider prefixes into Series/Season/Episode titles.

## Target domain model

Conceptually:

```text
Series: Amber Brown
│
└── Season 1
    ├── Episode 1
    │   ├── canonical metadata (title, synopsis, air date, still...)
    │   ├── Availability: IPTV / FR / 1080p / provider stream A
    │   └── Availability: IPTV / VO / 4K / provider stream B
    │
    ├── Episode 2
    │   └── Availability: IPTV / FR / 4K
    │
    └── ...
```

TMDB may describe the canonical structure and metadata. Xtream/provider data determines which episodes/variants are actually available and how they are played.

## Included

### 1. Inspect and use the real Xtream Series APIs/data

The Planner must inspect the existing Xtream integration and determine which provider calls/data expose:

- Series identity;
- seasons;
- episodes;
- episode IDs/stream IDs;
- season number;
- episode number;
- extension/container when available;
- language/quality/provider naming signals;
- playback information required by the existing playback resolver.

Do not infer the complete episode catalogue only from the Series-level list when Xtream exposes dedicated Series info/episode data.

### 2. Build canonical Season and Episode entities

For each resolved Series:

- create/update canonical Seasons using stable local identity and season number;
- create/update canonical Episodes using stable local identity plus canonical series/season/episode coordinates;
- enrich Season/Episode metadata from TMDB when a canonical TMDB Series identity is known;
- persist useful canonical fields supported by the current schema, such as episode title, overview, air date, runtime/still where available;
- keep provider-specific names/IDs out of canonical titles.

The implementation should reuse/extend the existing domain model if Season/Episode entities already exist rather than creating parallel structures.

### 3. Map provider episodes to canonical Episodes

Provider episode streams must be matched to the correct canonical Episode using the strongest available signals, prioritizing explicit structured provider season/episode numbers and IDs over fragile title parsing.

When provider metadata is incomplete, title parsing such as `S01E03`, `1x03`, localized naming patterns, etc. may be used as a fallback if needed, but matching must be conservative.

Never attach an episode stream to the wrong episode merely to avoid leaving it unresolved.

### 4. Episode Availability variants

A canonical Episode can have multiple playable variants from one or several sources.

Variant-specific information belongs to Availability, including where available:

- source/provider;
- provider episode/stream ID;
- language/audio hints;
- subtitles hints;
- quality/resolution;
- container/extension;
- raw provider title;
- playback information required by the resolver.

Equivalent FR/VO/4K/1080p provider entries for the same episode must not create duplicate canonical Episodes.

### 5. Series detail API/UI contract

The backend contract consumed by the Series detail page must expose enough information to render:

- canonical Series title and metadata;
- ordered seasons;
- ordered episodes within a selected season;
- episode title/number/metadata;
- whether each episode is currently playable;
- available episode variants where appropriate;
- a deterministic/default Availability selection compatible with playback preferences.

The existing Series page should stop displaying `Les saisons ne sont pas encore disponibles` when season/episode data actually exists for the source.

A reasonable UX should support selecting a Season and seeing its episodes without requiring separate provider-specific navigation.

### 6. Playback integration

Selecting Play on an Episode must resolve/play the **episode Availability**, not the Series-level provider item.

Integrate with the existing playback resolver/contracts rather than creating an unrelated player path.

Episode playback must preserve enough source identifiers to construct/resolve the correct Xtream stream URL.

Browser codec/container compatibility itself is not the primary scope of this ticket, but the correct episode Availability must reach the playback layer and resolution failures must be distinguishable from missing episode ingestion.

### 7. Existing already-synchronized Series

This must not only work for Series discovered after deployment.

Provide a safe reconciliation/backfill path for existing Series that are already in the database but have missing/incomplete Season/Episode structure.

The implementation must be able to revisit an existing matched Series, fetch its provider Series info/episodes, create/reconcile Seasons/Episodes and attach episode Availabilities **without deleting and recreating the IPTV source**.

The exact execution mechanism should fit the repository architecture and may reuse sync/backfill infrastructure from #123 where appropriate.

### 8. Idempotency and provider updates

Repeated sync/reconciliation must:

- not duplicate Seasons;
- not duplicate Episodes;
- not duplicate unchanged episode Availabilities;
- add newly appeared episodes;
- update changed provider metadata safely;
- handle removed/unavailable provider episodes according to the repository's existing Availability lifecycle semantics;
- preserve canonical Episode identity and user state across provider refreshes.

### 9. Preserve episode-level user state

Where supported by the current/future schema, reconciliation must preserve references such as:

- playback progress;
- watched/completed state;
- continue-watching state;
- episode history;
- selected/preferred Availability.

Do not make an ordinary provider resync recreate episode identities and lose progress.

### 10. TMDB enrichment must not define availability

TMDB can provide a complete canonical Season/Episode structure even when the IPTV provider only has some episodes.

The model/API must distinguish:

- canonical episode exists;
- episode has one or more playable Availability records;
- episode is known but currently unavailable.

Do not fabricate playback availability merely because an Episode exists in TMDB.

This distinction is important for future features such as missing-episode visibility, new-episode alerts and radar/tracking.

## Acceptance Criteria

- [ ] A matched Xtream Series with provider episode data produces ordered Season and Episode entities.
- [ ] Existing already-synced Series can have their missing Season/Episode structure backfilled without deleting/recreating the source.
- [ ] Season/Episode ingestion uses structured Xtream Series/episode information when available rather than relying exclusively on raw title parsing.
- [ ] Canonical Episode identity is based on the canonical Series + season/episode coordinates/metadata, not on a provider stream title.
- [ ] TMDB enrichment populates canonical Season/Episode metadata when a TMDB Series identity is known.
- [ ] Multiple provider streams for the same episode converge on one Episode with multiple Availability variants.
- [ ] Language, quality, raw provider title and provider stream IDs remain Availability/source concerns.
- [ ] The Series detail API returns seasons and ordered episodes with playable/unavailable state.
- [ ] The web Series detail page renders real Season/Episode data when available instead of the current empty-state message.
- [ ] A user can select an Episode and playback resolves the selected/default **episode** Availability.
- [ ] Canonical Series/Episode titles do not display provider prefixes such as `4K-A+ -`, `FR -`, `EN -`, etc. after successful canonical enrichment.
- [ ] TMDB-only Episodes without provider Availability are never falsely marked playable.
- [ ] Re-running sync/backfill is idempotent and does not duplicate Seasons, Episodes or Availability variants.
- [ ] Newly added provider episodes appear after a subsequent sync/reconciliation.
- [ ] Existing episode playback progress/watched state is preserved across reconciliation where such state exists.
- [ ] Failures fetching one Series' episode information do not corrupt the rest of the catalogue sync and are retryable/diagnosable.
- [ ] Automated tests cover Series info ingestion, multiple seasons, episode ordering, multi-variant episode Availability, partial provider availability, existing-Series backfill, idempotency, newly-added episodes and playback resolution handoff.

## Out of scope

- Rebuilding the global title matching algorithm from #122.
- Recommendation/taste engine and automatic shelves.
- Skip-intro/recap detection.
- Autoplay/never-stop episode sequencing unless already naturally supported by existing playback contracts.
- Solving every browser codec incompatibility.
- Importing all TMDB Series globally when they are unrelated to the user's catalogue/discovery pool.

## Dependencies / relationship to other work

- Reuse the canonical Series identity and title-matching behavior from #122.
- Reuse reconciliation/backfill patterns from #123 where appropriate.
- Preserve the core domain rule: `Series/Season/Episode = canonical content`; `Availability = where/how that episode can be watched`.
- The Planner must inspect the existing Xtream Series-info API client, persistence schema, Series detail endpoint and playback resolver before introducing new abstractions.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
