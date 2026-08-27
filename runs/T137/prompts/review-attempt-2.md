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


# T137 — Build universal Live TV search across canonical channels and EPG programs

**Source**: GitHub Issue #292

## Description

## Context

IPTVFlix Live now needs search to answer the user's actual intent, not only match channel names.

Examples:
- `TF1` → find the canonical channel.
- `US Open` → find channels broadcasting US Open content now and upcoming broadcasts.
- `Fort Boyard` → find the channel(s) carrying it now, or the next scheduled broadcasts with date/time.
- Natural query wording such as `je veux regarder US Open` should still resolve to the relevant program intent where feasible without introducing an LLM dependency for every search.

This search will power Android TV first but must be exposed as a reusable backend capability for other IPTVFlix clients.

## Goal

Create a unified search API/index over **canonical Live TV channels + EPG programs**, with explicit distinction between content airing now and future broadcasts.

## Search domains

### Canonical channels
Search canonical channel fields such as:
- channel name;
- normalized aliases where available;
- category/country/language where useful.

Never return raw duplicate `ChannelSource` entries as separate user-facing results.

### EPG programs
Index/search useful EPG metadata when available:
- title;
- subtitle/episode title;
- description/summary with a lower ranking weight;
- canonical channel;
- start/end timestamps.

Search must support partial/normalized matching and be resilient to accents/casing/basic punctuation differences.

## Result semantics

Return enough structured information for clients to build at least these groups:

### LIVE_NOW
A matching program is currently airing.
Return:
- canonical channel id/name/logo;
- program title;
- start/end;
- progress where cheaply derivable;
- playback eligibility / information required to start the canonical channel.

### UPCOMING
A matching program is scheduled later.
Return:
- canonical channel;
- program title;
- localizable start/end timestamps;
- stable EPG/program identifier when available.

### CHANNEL
Direct channel-name matches independent of program search.

## Ranking

Rank with user intent in mind:
1. strong exact/near-exact LIVE_NOW program matches;
2. strong canonical channel matches where query resembles a channel;
3. upcoming exact/near-exact program matches ordered by relevance and then soonest occurrence;
4. weaker description/semantic matches later.

Do not let a description containing `US Open` outrank a program actually titled `US Open`.

When multiple technical sources map to the same canonical channel/program occurrence, collapse them into one result.

## Natural query normalization

Support lightweight normalization of conversational prefixes such as:
- `je veux regarder ...`
- `mettre ...`
- `regarder ...`

Do this deterministically where possible. Do **not** require an LLM call for every search request.

## API / performance

- Expose a reusable endpoint/service suitable for Android TV remote search.
- Search must be fast enough for incremental text search; debounce remains a client concern.
- Avoid scanning/parsing raw provider playlists/EPG XML on every query.
- Use the existing persisted/cached EPG/canonical-channel data and add an appropriate search index/materialization if necessary.
- Define a bounded upcoming horizon (for example the EPG data horizon actually available) rather than returning stale historical schedules.
- No manual production DB changes; schema changes must use migrations if required.

## Edge cases

- EPG unavailable → channel search still works.
- Program exists on several canonical channels → return each meaningful broadcast/channel occurrence.
- Same program repeated later → expose useful upcoming occurrences without noisy duplicate rows.
- Program currently live and also scheduled later → LIVE_NOW result first; upcoming occurrences may also be returned.
- Timezones must remain unambiguous in API contracts; clients localize for display.

## Acceptance criteria

- [ ] One search API can return canonical channel and EPG-program matches.
- [ ] Query `US Open`-style program names can return current and upcoming broadcasts when present in EPG data.
- [ ] Querying a channel name returns the canonical channel without source duplicates.
- [ ] Results explicitly distinguish LIVE_NOW / UPCOMING / CHANNEL.
- [ ] Current broadcasts contain enough information for Android TV to start playback.
- [ ] Upcoming broadcasts contain canonical channel + date/time information.
- [ ] Exact/title matches rank above incidental description matches.
- [ ] Lightweight natural-language prefixes are normalized without per-query LLM usage.
- [ ] Search remains functional when EPG is absent or partial.
- [ ] Add tests for live matches, future matches, direct channel matches, duplicate source collapse, repeated programs, accents/case, no-EPG behavior and ranking.
- [ ] No provider/program-specific hardcoding.

---

## Contexte de retry injecté par run_ticket.py

## Review decision keywords

The review must end with exactly one valid workflow keyword on its own line.

Approval keyword:
IMPLEMENTATION_APPROVED

Fix required keyword:
IMPLEMENTATION_FIX_REQUIRED
